<script lang="ts">
  import Message from './Message.svelte';
  
  let { messages = [], repo = $bindable(''), branch = $bindable(''), instruction = $bindable(''), onSend, onAnswer }: {
    messages?: Array<{
      id: string;
      type: 'instruction' | 'question' | 'answer' | 'completion';
      content: string;
      time: string;
      eventId?: string;
      status?: 'success' | 'error' | 'pending';
      prUrl?: string;
    }>;
    repo?: string;
    branch?: string;
    instruction?: string;
    onSend: (instruction: string) => void;
    onAnswer: (eventId: string, answer: string) => void;
  } = $props();
  
  let messagesContainer = $state<HTMLDivElement | undefined>();
  
  $effect(() => {
    if (messagesContainer && messages.length > 0) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });
  
  function handleSend() {
    if (instruction.trim() && repo.trim()) {
      onSend(instruction);
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSend();
    }
  }
</script>

<div class="chat-view">
  <div class="messages" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="empty-state">
        <p>Enter AI instructions and send to get started</p>
        <p class="help">Example: Change the button color to blue</p>
      </div>
    {:else}
      {#each messages as message (message.id)}
        <Message {message} {onAnswer} />
      {/each}
    {/if}
  </div>
  
  <div class="input-area">
    <textarea
      bind:value={instruction}
      placeholder="Enter AI instructions...&#10;&#10;Example: Change the button color to blue"
      rows="3"
      onkeydown={handleKeydown}
    ></textarea>
    <button 
      onclick={handleSend}
      disabled={!instruction.trim() || !repo.trim()}
    >
      Send via Nostr
    </button>
    <p class="hint">Cmd+Enter or Ctrl+Enter to send</p>
  </div>
</div>

<style>
  .chat-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f9fafb;
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    text-align: center;
    padding: 2rem;
  }
  
  .empty-state p {
    margin: 0.5rem 0;
  }
  
  .empty-state .help {
    font-size: 0.875rem;
    opacity: 0.7;
  }
  
  .input-area {
    padding: 1rem;
    background: white;
    border-top: 1px solid #e5e7eb;
  }
  
  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-family: inherit;
    font-size: 1rem;
    resize: none;
    margin-bottom: 0.75rem;
    box-sizing: border-box;
  }
  
  textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  button {
    width: 100%;
    padding: 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  button:hover:not(:disabled) {
    background: #2563eb;
  }
  
  button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
  
  .hint {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
    text-align: center;
  }
</style>
