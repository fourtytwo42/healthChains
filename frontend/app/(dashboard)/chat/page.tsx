'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { useProviders, usePatients } from '@/hooks/use-api';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response (mock)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `This is a mock response to: "${userMessage.content}". The chat functionality is currently in development and will be connected to the backend soon.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
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
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <h1 className="text-2xl font-bold">Chat with Fred</h1>
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
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-2">
              <p className="text-lg font-semibold">Start a conversation with Fred</p>
              <p className="text-sm text-muted-foreground">
                Ask questions or have a conversation. This is a mock chat interface.
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
                    <Image
                      src="/avatars/fred-avatar.png"
                      alt="Fred AI"
                      fill
                      className="object-cover"
                      onError={(e) => {
                        // Fallback if image doesn't exist
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center text-primary font-semibold">
                      F
                    </div>
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
                    <Image
                      src="/avatars/user-avatar.png"
                      alt={userDisplayName}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        // Fallback if image doesn't exist
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center text-secondary-foreground font-semibold">
                      {userDisplayName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted">
                <Image
                  src="/avatars/fred-avatar.png"
                  alt="Fred AI"
                  fill
                  className="object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  F
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start">
              <div className="text-xs text-muted-foreground mb-1 px-2">Fred</div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t pt-4">
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

