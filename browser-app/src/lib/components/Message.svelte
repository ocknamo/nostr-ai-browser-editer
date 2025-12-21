<script lang="ts">
  let { message, onAnswer = null }: {
    message: {
      id: string;
      type: 'instruction' | 'question' | 'answer' | 'completion';
      content: string;
      time: string;
      eventId?: string;
      status?: 'success' | 'error' | 'pending';
      prUrl?: string;
    };
    onAnswer?: ((eventId: string, answer: string) => void) | null;
  } = $props();
  
  let answerText = $state('');
  
  function handleAnswer() {
    if (answerText.trim() && onAnswer && message.eventId) {
      onAnswer(message.eventId, answerText);
      answerText = '';
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleAnswer();
    }
  }
</script>

<div class="message {message.type}">
  <div class="time">{message.time}</div>
  <div class="content">{message.content}</div>
  
  {#if message.type === 'question' && onAnswer}
    <div class="answer-input">
      <input 
        type="text" 
        bind:value={answerText}
        placeholder="Type your answer..."
        onkeydown={handleKeydown}
      />
      <button onclick={handleAnswer} disabled={!answerText.trim()}>
        Send
      </button>
    </div>
  {/if}
  
  {#if message.type === 'completion'}
    <div class="status {message.status || 'pending'}">
      {#if message.status === 'success'}
        Success
      {:else if message.status === 'error'}
        Error
      {:else}
        Processing...
      {/if}
    </div>
    
    {#if message.prUrl}
      <a href={message.prUrl} target="_blank" rel="noopener noreferrer">
        View PR
      </a>
    {/if}
  {/if}
</div>

<style>
  .message {
    background: white;
    padding: 1rem;
    margin-bottom: 0.75rem;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .message.instruction {
    background: #dbeafe;
    border-left: 4px solid #3b82f6;
  }
  
  .message.question {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
  }
  
  .message.answer {
    background: #e0e7ff;
    border-left: 4px solid #6366f1;
  }
  
  .message.completion {
    background: #dcfce7;
    border-left: 4px solid #22c55e;
  }
  
  .time {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
  }
  
  .content {
    color: #1f2937;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .answer-input {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  
  .answer-input input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }
  
  .answer-input input:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
  }
  
  .answer-input button {
    padding: 0.5rem 1rem;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .answer-input button:hover:not(:disabled) {
    background: #d97706;
  }
  
  .answer-input button:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }
  
  .status {
    display: inline-block;
    margin-top: 0.5rem;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .status.success {
    background: #d1fae5;
    color: #065f46;
  }
  
  .status.error {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .status.pending {
    background: #e5e7eb;
    color: #4b5563;
  }
  
  a {
    display: inline-block;
    margin-top: 0.5rem;
    margin-left: 0.5rem;
    color: #2563eb;
    text-decoration: none;
    font-size: 0.875rem;
  }
  
  a:hover {
    text-decoration: underline;
  }
</style>
