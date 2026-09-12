import { mount } from 'svelte';
import Enquete from './Enquete.svelte';
import '../app.css';

const target = document.querySelector('#app');
if (target === null) throw new Error('Point de montage #app introuvable.');

export default mount(Enquete, { target });
