import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const target = document.querySelector('#app');
if (target === null) throw new Error('Point de montage #app introuvable.');

export default mount(App, { target });
