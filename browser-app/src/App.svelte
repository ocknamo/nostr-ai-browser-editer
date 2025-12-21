<script lang="ts">
  import Header from './lib/components/Header.svelte';
  import ChatView from './lib/components/ChatView.svelte';
  import PreviewView from './lib/components/PreviewView.svelte';
  import { NostrClient } from './lib/nostr-client';
  
  // Generate UUID v4
  function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Format time for display
  function formatTime(): string {
    return new Date().toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Parse GitHub URL to owner/repo format
  function parseGitHubRepo(input: string): string {
    // If it's already in owner/repo format, return as-is
    if (/^[^/]+\/[^/]+$/.test(input.trim())) {
      return input.trim();
    }
    
    // Try to parse GitHub URL
    try {
      const url = new URL(input);
      if (url.hostname === 'github.com') {
        const parts = url.pathname.split('/').filter(p => p);
        if (parts.length >= 2) {
          return `${parts[0]}/${parts[1]}`;
        }
      }
    } catch {
      // Not a valid URL, return as-is
    }
    
    return input.trim();
  }
  
  type MessageType = 'instruction' | 'question' | 'answer' | 'completion';
  
  interface Message {
    id: string;
    type: MessageType;
    content: string;
    time: string;
    eventId?: string;
    status?: 'success' | 'error' | 'pending';
    prUrl?: string;
  }
  
  let activeView = $state<'chat' | 'preview'>('chat');
  let repo = $state('');
  let branch = $state('main');
  let instruction = $state('');
  let messages = $state<Message[]>([]);
  let npub = $state('');
  let currentRequestId = $state<string | null>(null);
  
  let nostrClient: NostrClient;
  
  $effect(() => {
    // Initialize Nostr client
    (async () => {
      nostrClient = new NostrClient();
      await nostrClient.init();
      npub = nostrClient.getNpub();
      
      // Subscribe to events
      nostrClient.onMessage((event) => {
        if (event.kind === 30102) {
          // AI question
          const newMessage: Message = {
            id: event.id,
            type: 'question',
            content: event.content,
            eventId: event.id,
            time: formatTime()
          };
          messages = [...messages, newMessage];
        } else if (event.kind === 30104) {
          // Completion notification
          const status = event.tags.find(t => t[0] === 'status')?.[1] as 'success' | 'error' | undefined;
          const prUrl = event.tags.find(t => t[0] === 'pr_url')?.[1];
          
          const newMessage: Message = {
            id: event.id,
            type: 'completion',
            content: event.content,
            status: status || 'pending',
            prUrl,
            time: formatTime()
          };
          messages = [...messages, newMessage];
        }
      });
      
      nostrClient.subscribe();
    })();
  });
  
  async function handleSendInstruction(inst: string) {
    const requestId = generateUUID();
    currentRequestId = requestId;
    
    // Normalize repo format
    const normalizedRepo = parseGitHubRepo(repo);
    
    try {
      await nostrClient.sendInstruction(normalizedRepo, branch, inst, requestId);
      
      const newMessage: Message = {
        id: requestId,
        type: 'instruction',
        content: inst,
        time: formatTime()
      };
      messages = [...messages, newMessage];
      
      instruction = '';
    } catch (error) {
      console.error('Failed to send instruction:', error);
      const errorMessage: Message = {
        id: generateUUID(),
        type: 'completion',
        content: `Failed to send: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'error',
        time: formatTime()
      };
      messages = [...messages, errorMessage];
    }
  }
  
  async function handleAnswer(questionEventId: string, answer: string) {
    if (!currentRequestId) return;
    
    // Normalize repo format
    const normalizedRepo = parseGitHubRepo(repo);
    
    try {
      await nostrClient.sendAnswer(normalizedRepo, branch, currentRequestId, questionEventId, answer);
      
      const newMessage: Message = {
        id: generateUUID(),
        type: 'answer',
        content: answer,
        time: formatTime()
      };
      messages = [...messages, newMessage];
    } catch (error) {
      console.error('Failed to send answer:', error);
    }
  }
  
  function handleViewChange(view: 'chat' | 'preview') {
    activeView = view;
  }
</script>

<div class="app">
  <Header 
    {npub} 
    {activeView}
    bind:repo
    bind:branch
    onViewChange={handleViewChange}
  />
  
  <main>
    {#if activeView === 'chat'}
      <ChatView 
        {messages}
        bind:repo
        bind:branch
        bind:instruction
        onSend={handleSendInstruction}
        onAnswer={handleAnswer}
      />
    {:else}
      <PreviewView 
        bind:repo
        bind:branch
      />
    {/if}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  
  main {
    flex: 1;
    overflow: hidden;
  }
</style>
