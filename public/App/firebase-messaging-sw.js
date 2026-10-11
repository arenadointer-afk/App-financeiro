importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDDguzJOP5GKqlqf8GW-xdsTCxh1Ha7C7k",
  authDomain: "sutello-financeiro.firebaseapp.com",
  projectId: "sutello-financeiro",
  storageBucket: "sutello-financeiro.firebasestorage.app",
  messagingSenderId: "460447549653",
  appId: "1:460447549653:web:a36b0c7d2c2919ff633a5c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const titulo = payload?.notification?.title || 'Sutello Financeiro';
  const opcoes = {
    body: payload?.notification?.body || 'Lembrete de conta a vencer!',
    icon: './icon-192.png',
    badge: './icon-192.png'
  };
  self.registration.showNotification(titulo, opcoes);
});
