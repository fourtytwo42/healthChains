'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { useProviders, usePatients, useChatMessage, useRequestAccess } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Send, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { executeTool, type ToolCall } from '@/lib/ai-tools';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tool_calls?: ToolCall[];
  tool_results?: Array<{
    tool_call_id: string;
    name: string;
    result: unknown;
    error?: string;
  }>;
}

/**
 * Chat Page - AI Chat Interface
 * Placeholder avatars:
 * - AI: frontend/public/avatars/fred-avatar.png
 * - User: frontend/public/avatars/user-avatar.png
 */
export default function ChatPage() {
  const { account } = useWallet();
  const { role, isLoading: roleLoading } = useRole(account);
  const { data: providersData } = useProviders();
  const { data: patientsData } = usePatients({ enabled: !!account });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageErrors, setImageErrors] = useState<{ fred: boolean; user: boolean }>({ fred: false, user: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatMutation = useChatMessage();
  const requestAccessMutation = useRequestAccess();
  const currentAiMessageRef = useRef<string>('');
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());

  // LocalStorage key for chat history (per user)
  const getStorageKey = () => {
    return account ? `chatHistory_${account.toLowerCase()}` : 'chatHistory';
  };

  // Load chat history from localStorage on mount
  useEffect(() => {
    if (!account) return;
    
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const parsedMessages = JSON.parse(stored).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(parsedMessages);
      }
    } catch (error) {
      console.error('Error loading chat history from localStorage:', error);
    }
  }, [account]);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (!account || messages.length === 0) return;
    
    try {
      // Convert Date objects to ISO strings for storage
      const messagesToStore = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }));
      localStorage.setItem(getStorageKey(), JSON.stringify(messagesToStore));
    } catch (error) {
      console.error('Error saving chat history to localStorage:', error);
      // If storage is full, try to clear old messages
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old messages');
        // Keep only the last 50 messages
        const recentMessages = messages.slice(-50).map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(),
        }));
        localStorage.setItem(getStorageKey(), JSON.stringify(recentMessages));
      }
    }
  }, [messages, account]);

  // Get user display name
  const getUserDisplayName = () => {
    if (!account) return 'User';
    
    if (role?.role === 'provider' || role?.role === 'both') {
      const currentProvider = providersData?.find((p: any) => 
        p.blockchainIntegration?.walletAddress?.toLowerCase() === account?.toLowerCase()
      );
      return currentProvider?.organizationName || 'Provider';
    }
    
    if (role?.role === 'patient') {
      const currentPatient = patientsData?.find((p: any) => 
        p.blockchainIntegration?.walletAddress?.toLowerCase() === account?.toLowerCase()
      );
      if (currentPatient?.demographics) {
        return `${currentPatient.demographics.firstName} ${currentPatient.demographics.lastName}`.trim() || 'Patient';
      }
      return 'Patient';
    }
    
    return 'User';
  };

  const userDisplayName = getUserDisplayName();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount and after AI responses
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep focus on input after loading completes
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setIsLoading(true);

    // Create AI message placeholder with unique ID
    const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMessage]);
    currentAiMessageRef.current = '';

    // Build conversation history for API (include tool calls and results)
    const conversationHistory: Array<{
      role: 'user' | 'assistant' | 'system' | 'tool';
      content: string;
      tool_calls?: ToolCall[];
      tool_call_id?: string;
    }> = [];

    messages.forEach((msg) => {
      // Add user/assistant message with content
      if (msg.content && msg.content.trim() !== '') {
        const historyMsg: {
          role: 'user' | 'assistant' | 'tool';
          content: string;
          tool_calls?: ToolCall[];
        } = {
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        };

        // Don't include tool_calls in conversation history - they cause issues with Groq
        // Tool results (tool messages) provide all necessary context for the AI
        // Just include the assistant's text response
        conversationHistory.push(historyMsg);
      }

      // IMPORTANT: Do NOT include tool messages from previous executions in conversation history
      // When sending new tool results, we'll add the assistant message with tool_calls and tool messages
      // Including old tool messages causes Groq to see orphaned tool messages without matching tool_calls
      // The assistant's text responses already contain the information from tool results
    });

    // Helper function to execute tools and continue conversation
    const executeToolsAndContinue = async (toolCalls: ToolCall[]) => {
      console.group('[Tool Execution] Starting tool execution');
      console.log('Tool calls received:', JSON.stringify(toolCalls, null, 2));

      if (!account) {
        throw new Error('Wallet not connected');
      }

      const toolResults: Message['tool_results'] = [];

      for (const toolCall of toolCalls) {
        try {
          console.log(`[Tool Execution] Executing: ${toolCall.function.name}`);
          console.log(`[Tool Execution] Arguments: ${toolCall.function.arguments}`);

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            throw new Error(`Invalid tool arguments: ${toolCall.function.arguments}`);
          }

          // Special handling for request_consent (requires MetaMask)
          if (toolCall.function.name === 'request_consent') {
            const result = await executeTool(toolCall.function.name as any, args, account);
            if (result && typeof result === 'object' && 'requiresMetaMask' in result && result.requiresMetaMask) {
              // Trigger MetaMask transaction
              console.log('[Tool Execution] Triggering MetaMask transaction for request_consent');
              try {
                const txResult = await requestAccessMutation.mutateAsync({
                  patientAddress: args.patientAddress as string,
                  dataTypes: args.dataTypes as string[],
                  purposes: args.purposes as string[],
                  expirationTime: (args.expirationTime as number) || 0,
                });
                toolResults.push({
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  result: {
                    success: true,
                    requestId: txResult.requestId,
                    transactionHash: txResult.transactionHash,
                    message: 'Consent request sent successfully. The patient will be notified.',
                  },
                });
              } catch (error: any) {
                console.error('[Tool Execution] MetaMask transaction failed:', error);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  result: null,
                  error: error.message || 'Transaction failed',
                });
              }
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                result: result,
              });
            }
          } else {
            // Execute other tools normally
            const result = await executeTool(toolCall.function.name as any, args, account);
            toolResults.push({
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              result: result,
            });
          }

          console.log(`[Tool Execution] Completed: ${toolCall.function.name}`);
        } catch (error: any) {
          console.error(`[Tool Execution] Error executing ${toolCall.function.name}:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            result: null,
            error: error.message || 'Tool execution failed',
          });
        }
      }

      console.log('[Tool Execution] All tools completed. Results:', toolResults);
      console.groupEnd();

      // Update message with tool calls and results
      // IMPORTANT: Append to existing tool_calls and tool_results, don't replace them
      // Only add tool calls that don't already exist (by ID) to avoid duplicates
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== aiMessageId) return msg;
          
          const existingToolCallIds = new Set((msg.tool_calls || []).map(tc => tc.id));
          const newToolCalls = toolCalls.filter(tc => !existingToolCallIds.has(tc.id));
          
          return {
            ...msg,
            tool_calls: [...(msg.tool_calls || []), ...newToolCalls],
            tool_results: [...(msg.tool_results || []), ...toolResults],
          };
        })
      );

      // Send tool results back to AI and get follow-up response
      // Groq expects: assistant message with tool_calls, then tool messages with tool_call_id
      const toolMessages = toolResults.map((tr) => ({
        role: 'tool' as const,
        tool_call_id: tr.tool_call_id,
        content: tr.error ? JSON.stringify({ error: tr.error }) : JSON.stringify(tr.result),
      }));

      // Include the assistant message with tool_calls, then tool messages
      // This matches Groq's expected format for tool results
      // ALWAYS include the assistant message with tool_calls when sending tool messages
      const assistantMessageWithToolCalls = {
        role: 'assistant' as const,
        content: '', // Empty content is fine for assistant messages with tool_calls
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };

      const followUpHistory = [
        ...conversationHistory,
        assistantMessageWithToolCalls,
        ...toolMessages,
      ];

      // Append the AI response to the same message that has the tool calls
      // Don't create a new message - combine tool calls and response in one message
      currentAiMessageRef.current = '';

      // Get AI response with tool results
      // Send a placeholder message since backend requires non-empty message
      await chatMutation.mutateAsync({
        message: 'Continue', // Placeholder message when sending tool results
        conversationHistory: followUpHistory as any,
        onChunk: (chunk: string) => {
          currentAiMessageRef.current += chunk;
          const currentContent = currentAiMessageRef.current;
          // Update the same message that has the tool calls, not a new one
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: currentContent }
                : msg
            )
          );
        },
        onToolCall: (newToolCalls: unknown[]) => {
          // Immediately show new tool calls in the UI before execution
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    tool_calls: [...(msg.tool_calls || []), ...(newToolCalls as ToolCall[])],
                  }
                : msg
            )
          );
          
          // Handle nested tool calls if needed
          executeToolsAndContinue(newToolCalls as ToolCall[]);
        },
      });
    };

    try {
      await chatMutation.mutateAsync({
        message: userInput,
        conversationHistory,
        onChunk: (chunk: string) => {
          // Update ref first
          currentAiMessageRef.current += chunk;
          // Capture the current content value to avoid closure issues
          const currentContent = currentAiMessageRef.current;
          // Update state with the captured value
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: currentContent }
                : msg
            )
          );
        },
        onToolCall: (toolCalls: unknown[]) => {
          console.group('[AI Response] Tool calls detected');
          console.log('Raw tool calls:', JSON.stringify(toolCalls, null, 2));
          console.groupEnd();
          
          // Immediately show tool calls in the UI before execution
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    tool_calls: [...(msg.tool_calls || []), ...(toolCalls as ToolCall[])],
                  }
                : msg
            )
          );
          
          // Execute tools and continue conversation
          executeToolsAndContinue(toolCalls as ToolCall[]);
        },
      });
    } catch (error) {
      console.error('Chat mutation error:', error);
      // Update AI message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      // Don't clear the ref here - it might still be needed for the final render
      // The ref will be reset on the next message
      // Focus input after response completes so user can continue typing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
      // Clear from page state
      setMessages([]);
      // Clear from localStorage
      try {
        const storageKey = getStorageKey();
        localStorage.removeItem(storageKey);
        console.log('Chat history cleared from both page and localStorage');
      } catch (error) {
        console.error('Error clearing chat history from localStorage:', error);
      }
      // Reset AI message ref
      currentAiMessageRef.current = '';
      // Focus input after clearing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show loading or no account state
  if (roleLoading || !account) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Chat</h1>
          <p className="text-muted-foreground">
            {!account ? 'Please connect your wallet to use chat' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Only providers can use chat
  if (role?.role !== 'provider' && role?.role !== 'both') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Chat</h1>
          <p className="text-muted-foreground">
            Chat is only available for providers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Header with Clear Button - Fixed at top */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b flex-shrink-0">
        <h1 className="text-2xl font-bold">Chat</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearChat}
          disabled={messages.length === 0}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Clear Chat
        </Button>
      </div>

      {/* Messages Container - Scrollable only this section */}
      <div 
        ref={chatContainerRef}
        className={`flex-1 min-h-0 space-y-4 pr-2 ${
          messages.length > 0 ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-2">
              <p className="text-lg font-semibold">Start a conversation</p>
              <p className="text-sm text-muted-foreground">
                Ask questions or have a conversation
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted">
                    {!imageErrors.fred ? (
                      <Image
                        src="/avatars/fred-avatar.png"
                        alt="Fred AI"
                        fill
                        className="object-cover"
                        unoptimized
                        onError={() => {
                          setImageErrors(prev => ({ ...prev, fred: true }));
                        }}
                      />
                    ) : null}
                    {imageErrors.fred && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center text-primary font-semibold">
                        F
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div
                className={`flex flex-col max-w-[75%] ${
                  message.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="text-xs text-muted-foreground mb-1 px-2">
                  {message.role === 'user' ? userDisplayName : 'Fred'}
                </div>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {/* Tool Calls Display - Discreet like ChatGPT */}
                      {message.tool_calls && message.tool_calls.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {message.tool_calls.map((toolCall) => {
                            const isExpanded = expandedToolCalls.has(toolCall.id);
                            const toolResult = message.tool_results?.find(tr => tr.tool_call_id === toolCall.id);
                            const hasError = toolResult?.error;
                            const isExecuting = !toolResult;

                            return (
                              <div
                                key={toolCall.id}
                                className="text-xs border rounded-md p-2 bg-background/50"
                              >
                                <button
                                  onClick={() => {
                                    setExpandedToolCalls((prev) => {
                                      const next = new Set(prev);
                                      if (isExpanded) {
                                        next.delete(toolCall.id);
                                      } else {
                                        next.add(toolCall.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="flex items-center gap-1 w-full text-left text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                  <span className="font-medium">
                                    {isExecuting ? '⚙️' : hasError ? '❌' : '✓'} {toolCall.function.name}
                                  </span>
                                </button>
                                {isExpanded && (
                                  <div className="mt-1 pl-4 space-y-1 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Arguments: </span>
                                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                        {toolCall.function.arguments.substring(0, 100)}
                                        {toolCall.function.arguments.length > 100 ? '...' : ''}
                                      </code>
                                    </div>
                                    {toolResult && (
                                      <div>
                                        <span className="text-muted-foreground">Result: </span>
                                        {hasError ? (
                                          <span className="text-destructive">{toolResult.error}</span>
                                        ) : (
                                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                            {JSON.stringify(toolResult.result).substring(0, 200)}
                                            {JSON.stringify(toolResult.result).length > 200 ? '...' : ''}
                                          </code>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {message.content ? (
                    message.role === 'assistant' ? (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none break-words [&_*]:text-foreground [&_*]:dark:text-foreground [&_table]:!block [&_table]:!my-4 [&_table]:!w-full [&_table]:!overflow-x-auto [&_table]:!border-collapse">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                          // Style tables - ensure they render as HTML tables, not plain text
                          table: ({ node, children, ...props }: any) => (
                            <div className="overflow-x-auto my-4 w-full">
                              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 table-auto" {...props}>
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ node, children, ...props }: any) => (
                            <thead className="bg-gray-100 dark:bg-gray-800" {...props}>
                              {children}
                            </thead>
                          ),
                          tbody: ({ node, children, ...props }: any) => (
                            <tbody {...props}>
                              {children}
                            </tbody>
                          ),
                          tr: ({ node, children, ...props }: any) => (
                            <tr className="border-b border-gray-200 dark:border-gray-700" {...props}>
                              {children}
                            </tr>
                          ),
                          th: ({ node, children, ...props }: any) => (
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold whitespace-nowrap" {...props}>
                              {children}
                            </th>
                          ),
                          td: ({ node, children, ...props }: any) => (
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2" {...props}>
                              {children}
                            </td>
                          ),
                          // Style code blocks
                          code: ({ node, className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return match ? (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            ) : (
                              <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs" {...props}>
                                {children}
                              </code>
                            );
                          },
                          // Style blockquotes
                          blockquote: ({ node, ...props }) => (
                            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2" {...props} />
                          ),
                          // Style lists
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc list-inside my-2 space-y-1" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal list-inside my-2 space-y-1" {...props} />
                          ),
                          // Style links
                          a: ({ node, ...props }) => (
                            <a className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300" target="_blank" rel="noopener noreferrer" {...props} />
                          ),
                          // Style paragraphs
                          p: ({ node, ...props }) => (
                            <p className="my-1" {...props} />
                          ),
                        }}
                      >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    )
                  ) : (
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted">
                    {!imageErrors.user ? (
                      <Image
                        src="/avatars/user-avatar.png"
                        alt={userDisplayName}
                        fill
                        className="object-cover"
                        unoptimized
                        onError={() => {
                          setImageErrors(prev => ({ ...prev, user: true }));
                        }}
                      />
                    ) : null}
                    {imageErrors.user && (
                      <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center text-secondary-foreground font-semibold">
                        {userDisplayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at bottom, just above footer */}
      <div className="border-t pt-4 pb-4 flex-shrink-0 mt-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="default"
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

