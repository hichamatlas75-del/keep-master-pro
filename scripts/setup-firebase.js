/**
 * KEEP MASTER PRO - Firebase Setup Guide & Diagnostics
 * Instructions complètes pour configurer Firebase Cloud avec le compte hichamprojets@gmail.com
 * sur le forfait gratuit Spark.
 *
 * Usage:
 *   node scripts/setup-firebase.js
 */

console.log(`
================================================================================
KEEP MASTER PRO — GUIDE OFFICIEL DE CONFIGURATION FIREBASE (FORFAIT SPARK GRATUIT)
================================================================================

Compte Administrateur : hichamprojets@gmail.com
Forfait requis : SPARK (100% Gratuit, AUCUNE carte bancaire requise)

Suivez ces 5 étapes simples sur la console Firebase :

--------------------------------------------------------------------------------
1. CRÉER LE PROJET FIREBASE
--------------------------------------------------------------------------------
1. Connectez-vous à la console Firebase : https://console.firebase.google.com/
   avec le compte hichamprojets@gmail.com.
2. Cliquez sur "Ajouter un projet" (Add project).
3. Nom du projet : KEEP MASTER PRO
4. Cliquez sur "Continuer".
5. Google Analytics : Vous pouvez le désactiver pour simplifier le projet gratuit.
6. Cliquez sur "Créer le projet".
7. Vérifiez que le projet reste sur le plan "Spark" (gratuit). Ne pas activer Blaze.

--------------------------------------------------------------------------------
2. ENREGISTRER L'APPLICATION WEB (PWA)
--------------------------------------------------------------------------------
1. Dans la page d'accueil de votre projet, cliquez sur l'icône Web "</>".
2. Surnom de l'application : "Keep Master Web".
3. Ne cochez pas Firebase Hosting pour l'instant (l'hébergement est géré par Cloudflare Pages).
4. Cliquez sur "Enregistrer l'application".
5. La console affiche votre objet "firebaseConfig" :
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId
6. Copiez ces valeurs dans les "Paramètres" (icône ⚙️) de l'application KEEP MASTER PRO.

--------------------------------------------------------------------------------
3. ACTIVER FIREBASE AUTHENTICATION
--------------------------------------------------------------------------------
1. Dans le menu de gauche, développez "Build" (Créer) -> cliquez sur "Authentication".
2. Cliquez sur "Commencer" (Get started).
3. Dans l'onglet "Sign-in method" (Modes de connexion) :
   - Cliquez sur "Adresse e-mail/Mot de passe".
   - Cochez "Activer".
   - Laissez "Lien par e-mail sans mot de passe" désactivé.
   - Cliquez sur "Enregistrer".

--------------------------------------------------------------------------------
4. CRÉER LA BASE CLOUD FIRESTORE
--------------------------------------------------------------------------------
1. Dans le menu de gauche, sous "Build" -> cliquez sur "Firestore Database".
2. Cliquez sur "Créer une base de données".
3. Emplacement : Choisissez votre région la plus proche (ex: europe-west1 ou us-central1).
4. Règles de sécurité : Choisissez "Démarrer en mode production".
5. Cliquez sur "Créer".

--------------------------------------------------------------------------------
5. DÉPLOYER LES RÈGLES DE SÉCURITÉ (firestore.rules)
--------------------------------------------------------------------------------
1. Dans votre base Firestore, ouvrez l'onglet "Règles" (Rules).
2. Remplacez le contenu par le fichier "firestore.rules" situé à la racine du projet.
3. Cliquez sur "Publier" (Publish).
   (Ces règles garantissent l'étanchéité stricte : chaque utilisateur ne peut
   lire et modifier que ses propres notes et libellés).

--------------------------------------------------------------------------------
6. INDEX COMPOSITE RECOMMANDÉ (OPTIMISATION FORFAIT SPARK)
--------------------------------------------------------------------------------
Pour optimiser les quotas gratuits Spark et accélérer la synchronisation delta :
- Collection : "notes"
- Champs indexés :
  - userId    : Ascending
  - updatedAt : Ascending
(Firestore proposera un lien automatique dans la console la première fois si besoin).

================================================================================
`);
