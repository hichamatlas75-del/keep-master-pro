# KEEP MASTER PRO 📝⚡

> Application de notes moderne, ultra-rapide, élégante et résiliente, inspirée de Google Keep, conçue exclusivement en PWA (Progressive Web App) Vanilla JavaScript ES Modules avec Google Firebase (Cloud Firestore & Authentication) et IndexedDB.

---

## 🌟 Vision & Spécifications Clés

- **Architecture Exclusive :** PWA installable sur Android, iOS (iPhone/iPad), Windows, macOS et tous navigateurs modernes.
- **Zéro Framework Lourd :** 100% Vanilla JavaScript ES Modules natifs, HTML5 sémantique, CSS3 moderne (Variables de design, Flexbox, Masonry CSS).
- **Mode Hors-Ligne Absolu (Offline-First) :** L'application fonctionne immédiatement en local via **IndexedDB**, sans dépendre d'une connexion réseau ou d'une configuration backend préalable.
- **Backend Officiel :** **Firebase Cloud Firestore & Authentication** (Forfait gratuit **Spark** sans carte bancaire requise).
- **Optimisation des Quotas Spark :**
  - Synchronisation différentielle ("Delta Sync") basée sur les horodatages `updatedAt` pour éliminer les lectures répétitives.
  - Écritures groupées atomiques (`writeBatch`) pour minimiser les requêtes.
  - Prévention stricte des boucles de synchronisation via détection de `hasPendingWrites`.
- **Stockage Local des Médias :** Images, dessins et enregistrements audio stockés localement en IndexedDB (DataURLs / Blobs) et intégrés dans les sauvegardes JSON sans surcoût de stockage externe.
- **Sauvegarde Indépendante :** Export et Import JSON complet avec validation de schéma, détection des doublons et rapport d'importation détaillé.

---

## 🚀 Fonctionnalités Détaillées

### 1. Gestion des Notes
- **Création instantanée :** Barre expandable intuitive ("Créer une note...").
- **Édition & Auto-sauvegarde :** Enregistrement automatique en direct sans perte de données.
- **Palette de 10 Couleurs Keep :** Par défaut, Corail, Pêche, Sable, Menthe, Sauge, Brume, Orage, Crépuscule, Fleur (harmonisation automatique en Mode Sombre et Mode Clair).
- **Épinglage :** Section dédiée "Épinglées" en haut de page.
- **Duplication :** Clonage de note en un clic.
- **Archivage & Corbeille :** Archivage réversible et corbeille sécurisée avec confirmation de suppression définitive.

### 2. Listes de Tâches Interactives (Checklists)
- Cases à cocher interactives.
- Réorganisation et déplacement automatique des éléments cochés vers le bas.
- Ajout rapide en appuyant sur `Entrée`.

### 3. Libellés & Organisation
- Création, renommage et suppression de libellés.
- Association multiple de libellés par note.
- Filtrage instantané dans la barre latérale.

### 4. Recherche & Filtres Avancés
- Recherche instantanée dans les titres, contenus, libellés et éléments de liste.
- Insensible à la casse et aux accents français.
- Filtres combinables : par type (notes, listes, dessins, audio) et par couleur.

### 5. Dessins & Croquis Intégrés (HTML5 Canvas)
- Outil Stylo et Gomme avec réglage de l'épaisseur du trait.
- Sélecteur de couleur interactif.
- Historique Annuler / Rétablir (Undo / Redo).
- Export direct au format PNG haute résolution attaché à la note.

### 6. Notes Vocales & Dictaphone
- Enregistrement audio via l'API Web `MediaRecorder`.
- Indicateur visuel et chronomètre en direct.
- Lecteur audio intégré directement dans la carte de note.
- Stockage local immédiat (Blob IndexedDB) et export JSON inclus.

### 7. Rappels & Notifications
- Programmation de rappels avec date, heure et récurrence (Quotidien, Hebdomadaire).
- Intégration de l'API Web Notifications et Service Worker.
- Vérification automatique des rappels échus lors de la réactivation de l'application.

### 8. Sauvegarde & Restauration JSON
- **Export JSON :** Sauvegarde complète de toutes les notes, listes, libellés, métadonnées et paramètres.
- **Import JSON :** Validation stricte du format, détection des doublons, mise à jour intelligente des versions et rapport d'importation détaillé.

---

## 🛠️ Architecture Technique

```
KEEP MASTER PRO/
├── .gitignore
├── .env.example              # Gabarit des identifiants publics Firebase
├── _headers                  # Règles de cache et sécurité Cloudflare Pages
├── firestore.rules           # Règles de sécurité Cloud Firestore
├── package.json              # Scripts npm (serve, test, icons)
├── index.html                # Point d'entrée de l'application PWA
├── manifest.json             # Manifeste PWA installable
├── sw.js                     # Service Worker (Cache API, Offline Shell, Sync)
├── icons/                    # Icônes PWA générées (192, 512, maskable, svg)
├── css/
│   ├── theme.css             # Tokens, couleurs Keep, modes Clair / Sombre
│   ├── layout.css            # Header, Sidebar, Masonry, Responsive layout
│   ├── components.css        # Note cards, créateur, modales, checklists
│   ├── responsive.css        # Optimisation mobile et tiroir tactile
│   └── main.css              # Reset et animations
├── js/
│   ├── app.js                # Orchestrateur principal
│   ├── config.js             # Configuration globale
│   ├── utils/
│   │   ├── event-bus.js      # Pub/Sub découplé
│   │   ├── helpers.js        # Utilitaires (UUID, formatters, debounce)
│   │   ├── sanitize.js       # Protection XSS et validateurs
│   │   └── notifications.js  # Notifications & Rappels
│   ├── database/
│   │   ├── schema.js         # Modèles de données
│   │   ├── indexeddb.js      # Moteur local de persistance offline
│   │   └── backup.js         # Moteur Export/Import JSON
│   ├── services/
│   │   ├── firebase.js       # Client SDK Firebase Web modulaire
│   │   ├── auth.js           # Gestion des comptes Firebase Auth
│   │   └── storage.js        # Gestion des pièces jointes et blobs locaux
│   ├── sync/
│   │   ├── sync-queue.js     # File d'attente IndexedDB persistante
│   │   ├── conflict-manager.js # Résolution des conflits par version
│   │   └── sync-engine.js    # Synchronisation bidirectionnelle Firestore
│   ├── modules/              # Modules métier (notes, checklist, labels...)
│   └── components/           # Composants d'interface utilisateur
├── scripts/
│   ├── serve.js              # Serveur statique de développement local
│   ├── setup-firebase.js     # Guide de configuration Firebase Spark
│   └── generate-icons.js     # Générateur d'icônes PWA
└── tests/                    # Tests unitaires automatisés Node.js
```

---

## 💻 Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org) v18+ (pour exécuter le serveur local et les tests).

### Lancement en local
```bash
# 1. Démarrer le serveur de développement local
npm start
# -> L'application s'ouvre sur http://localhost:3000
```

### Exécution des tests automatisés
```bash
npm test
```

---

## 🔥 Guide de Configuration Firebase Cloud (Forfait Spark Gratuit)

L'application fonctionne immédiatement en local sans configuration requise. Pour activer la synchronisation multi-appareils avec votre compte **`hichamprojets@gmail.com`** :

### Étape 1 : Créer le projet sur la Console Firebase
1. Rendez-vous sur [https://console.firebase.google.com/](https://console.firebase.google.com/).
2. Connectez-vous avec `hichamprojets@gmail.com`.
3. Cliquez sur **"Ajouter un projet"**.
4. Nommez le projet : `KEEP MASTER PRO`.
5. Désactivez Google Analytics (recommandé pour la simplicité du forfait gratuit).
6. Cliquez sur **"Créer le projet"**.
7. Vérifiez que le projet est bien sur le forfait **Spark** (100% gratuit).

### Étape 2 : Enregistrer l'application Web
1. Sur l'accueil du projet, cliquez sur l'icône Web **`</>`**.
2. Surnom de l'application : `Keep Master Web`.
3. Cliquez sur **"Enregistrer l'application"**.
4. Copiez les clés de l'objet `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, `appId`).

### Étape 3 : Activer Firebase Authentication
1. Dans le menu de gauche, allez dans **Build** -> **Authentication**.
2. Cliquez sur **"Commencer"**.
3. Dans l'onglet **"Modes de connexion"**, activez **"Adresse e-mail/Mot de passe"**.

### Étape 4 : Créer la Base Cloud Firestore
1. Dans le menu de gauche, allez dans **Build** -> **Firestore Database**.
2. Cliquez sur **"Créer une base de données"**.
3. Choisissez l'emplacement le plus proche (ex: `europe-west1` ou `us-central1`).
4. Choisissez **"Démarrer en mode production"** et validez.

### Étape 5 : Déployer les Règles de Sécurité
1. Ouvrez l'onglet **"Règles"** de Firestore.
2. Copiez-collez le contenu du fichier `firestore.rules` de ce dépôt.
3. Cliquez sur **"Publier"**.

### Étape 6 : Connexion dans KEEP MASTER PRO
1. Dans l'application, ouvrez les **Paramètres** (icône ⚙️ en haut à droite).
2. Saisissez votre **API Key** et votre **Project ID**.
3. Cliquez sur **"Enregistrer la configuration"** puis **"Tester la connexion"**.
4. Ouvrez l'icône de profil pour vous inscrire ou vous connecter.

---

## 📱 Installation PWA

- **Sur Android (Chrome) :** Menu `⋮` -> "Installer l'application" ou "Ajouter à l'écran d'accueil".
- **Sur iPhone / iPad (Safari) :** Bouton Partager -> "Sur l'écran d'accueil".
- **Sur PC / Mac (Chrome, Edge) :** Bouton d'installation dans la barre d'adresse ou Menu `...` -> "Installer KEEP MASTER PRO".

---

## 📄 Licence
Projet réalisé sous licence **MIT**.
