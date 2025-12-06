'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { useProviders, usePatients, useChatMessage } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Send } from 'lucide-react';
import Image from 'next/image';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
  const chatMutation = useChatMessage();
  const currentAiMessageRef = useRef<string>('');

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    // Build conversation history
    const conversationHistory = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

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
      setMessages([]);
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

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Header with Clear Button */}
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

      {/* Messages Container */}
      <div className={`flex-1 min-h-0 space-y-4 mb-4 pr-2 ${messages.length > 0 ? 'overflow-y-auto' : 'overflow-hidden'}`}>
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
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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

      {/* Input Area - Fixed at bottom */}
      <div className="border-t pt-4 pb-4 flex-shrink-0">
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

