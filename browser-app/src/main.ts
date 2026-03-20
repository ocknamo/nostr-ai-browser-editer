import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { createConsoleViewer } from 'console-daijin'

createConsoleViewer({ show: 'always' })

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
