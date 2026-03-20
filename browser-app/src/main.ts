import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const app = mount(App, {
  // biome-ignore lint/style/noNonNullAssertion: element is guaranteed by index.html
  target: document.getElementById('app')!,
});

export default app;
