import { mount } from 'svelte';
import Home from './Home.svelte';
import '../app.css';

/*
  L'entrée de l'accueil.

  Trois entrées, trois montages : c'est ce qui fait qu'une page ne charge que
  son propre code. L'accueil ne connaît ni le moteur, ni un plateau.
*/
const target = document.querySelector('#app');
if (target === null) throw new Error('Point de montage #app introuvable.');

export default mount(Home, { target });
