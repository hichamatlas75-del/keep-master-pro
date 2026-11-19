# KEEP MASTER PRO 📝⚡

> Application de notes moderne, ultra-rapide, élégante et résiliente, inspirée de Google Keep, conçue exclusivement en PWA (Progressive Web App) Vanilla JavaScript ES Modules avec Appwrite Cloud et IndexedDB.

---

## 🌟 Vision & Spécifications Clés

- **Architecture Exclusive :** PWA installable sur Android, iOS (iPhone/iPad), Windows, macOS et tous navigateurs modernes.
- **Zéro Framework Lourd :** 100% Vanilla JavaScript ES Modules natifs, HTML5 sémantique, CSS3 moderne (Variables de design, Flexbox, Masonry CSS).
- **Mode Hors-Ligne Absolu (Offline-First) :** L'application fonctionne immédiatement en local via **IndexedDB**, sans dépendre d'une connexion réseau ou d'une configuration backend préalable.
- **Backend & Synchronisation :** **Appwrite Cloud** (TablesDB/Databases, Account, Storage, Realtime) avec file d'attente de synchronisation et moteur de résolution de conflits par versionnage et horodatage.
- **Sauvegarde Indépendante :** Export et Import JSON complet avec validation de schéma, détection des doublons et stratégie de fusion.

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
- Stockage local immédiat (Blob IndexedDB) et synchronisation distante (Appwrite Storage).

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
├── .env.example              # Gabarit des identifiants publics Appwrite
├── _headers                  # Règles de cache et sécurité Cloudflare Pages
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
│   │   ├── schema.js         # Modèles de données conformes Appwrite
│   │   ├── indexeddb.js      # Moteur local de persistance offline
│   │   └── backup.js         # Moteur Export/Import JSON
│   ├── services/
│   │   ├── appwrite.js       # Client SDK Appwrite Cloud
│   │   ├── auth.js           # Gestion des comptes et sessions
│   │   └── storage.js        # Gestion des fichiers et blobs
│   ├── sync/
│   │   ├── sync-queue.js     # File d'attente IndexedDB persistante
│   │   ├── conflict-manager.js # Résolution des conflits par version
│   │   └── sync-engine.js    # Synchronisation bidirectionnelle Realtime
│   ├── modules/              # Modules métier (notes, checklist, labels...)
│   └── components/           # Composants d'interface utilisateur
├── scripts/
│   ├── serve.js              # Serveur statique de développement local
│   ├── setup-appwrite.js     # Script de provisionnement automatisé
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

## ☁️ Guide de Configuration Appwrite Cloud

L'application fonctionne immédiatement en local sans configuration requise. Pour activer la synchronisation multi-appareils :

### Étape 1 : Créer le projet sur Appwrite Cloud
1. Rendez-vous sur [https://cloud.appwrite.io](https://cloud.appwrite.io).
2. Créez un compte gratuit et cliquez sur **"Create project"**.
3. Nommez votre projet : `KEEP MASTER PRO`.
4. Choisissez l'identifiant du projet : `keep-master-pro`.

### Étape 2 : Déclarer la plateforme Web
1. Dans l'accueil de votre projet, cliquez sur **"Web App"** (icône HTML5).
2. Nom : `Keep Master Pro Web`.
3. Hostname : `localhost` pour le développement local, et `*.pages.dev` (ou votre domaine personnalisé) pour la production.

### Étape 3 : Créer la Base de Données
1. Dans le menu de gauche, cliquez sur **Databases**.
2. Cliquez sur **"Create database"** :
   - Nom : `KEEP MASTER PRO Database`
   - Database ID : `keep_master_db`

### Étape 4 : Créer les Collections
Créez les 4 collections suivantes dans la base `keep_master_db` avec les permissions **"Users" (Create, Read, Update, Delete)** :

| Collection | ID | Attributs essentiels |
|---|---|---|
| **Notes** | `notes` | `userId` (string), `title` (string), `content` (string), `type` (string), `color` (string), `pinned` (boolean), `archived` (boolean), `trashed` (boolean), `checklist` (string), `labels` (string[]), `reminder` (string), `attachments` (string), `version` (integer), `createdAt` (datetime), `updatedAt` (datetime) |
| **Labels** | `labels` | `userId` (string), `name` (string), `color` (string), `createdAt` (datetime) |
| **Reminders** | `reminders` | `userId` (string), `noteId` (string), `date` (datetime), `completed` (boolean) |
| **Shares** | `shares` | `noteId` (string), `ownerId` (string), `sharedWith` (string), `permission` (string), `createdAt` (datetime) |

### Étape 5 : Créer le Bucket de Stockage
1. Dans le menu de gauche, cliquez sur **Storage**.
2. Cliquez sur **"Create bucket"** :
   - Nom : `Keep Master Attachments`
   - Bucket ID : `attachments`
   - Permissions : **Users (Create, Read, Update, Delete)**
   - Extensions autorisées : `png, jpg, jpeg, gif, webp, svg, webm, mp4, wav, mp3`.

### Étape 6 : Connexion dans l'Application
1. Dans KEEP MASTER PRO, ouvrez le menu **Paramètres** (icône d'engrenage en haut à droite).
2. Entrez votre **Project ID** (`keep-master-pro`).
3. Cliquez sur **"Tester la connexion"** puis **"Enregistrer"**.
4. Cliquez sur l'icône de profil en haut à droite pour vous connecter ou créer votre compte.

---

## 📱 Installation PWA

- **Sur Android (Chrome) :** Menu `⋮` -> "Installer l'application" ou "Ajouter à l'écran d'accueil".
- **Sur iPhone / iPad (Safari) :** Bouton Partager -> "Sur l'écran d'accueil".
- **Sur PC / Mac (Chrome, Edge) :** Bouton d'installation dans la barre d'adresse ou Menu `...` -> "Installer KEEP MASTER PRO".

---

## 🔒 Sécurité & Bonnes Pratiques
- **Zéro clé secrète dans le code client :** Seuls les identifiants publics autorisés par Appwrite (`Endpoint` et `Project ID`) sont exposés.
- **Sanitisation HTML systématique :** Toutes les chaînes utilisateur passent par un filtre d'échappement pour bloquer toute injection XSS.
- **Isolation des données :** Les permissions Appwrite sont configurées au niveau des utilisateurs authentifiés (`Role.user()`), garantissant l'étanchéité stricte des données privées.

---

## 📄 Licence
Projet réalisé sous licence **MIT**.
