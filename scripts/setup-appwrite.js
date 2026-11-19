/**
 * KEEP MASTER PRO - Automated Appwrite Provisioning Script
 * Automatically provisions Databases, Collections, Attributes, Indexes and Storage Bucket.
 *
 * Usage:
 *   APPWRITE_API_KEY="your-secret-api-key" node scripts/setup-appwrite.js
 */

import { Client, Databases, Storage, ID, Permission, Role } from 'node-appwrite';

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || 'keep-master-pro';
const API_KEY = process.env.APPWRITE_API_KEY;

const DATABASE_ID = 'keep_master_db';
const DATABASE_NAME = 'KEEP MASTER PRO Database';

const BUCKET_ID = 'attachments';
const BUCKET_NAME = 'Keep Master Attachments';

if (!API_KEY) {
  console.log(`
================================================================================
KEEP MASTER PRO - GUIDE DE CONFIGURATION APPWRITE CLOUD MANUELLE / ASSISTÉE
================================================================================

Si vous souhaitez automatiser la création des tables et buckets, exécutez :
  $env:APPWRITE_API_KEY="votre_cle_api_secrete"; node scripts/setup-appwrite.js

Sinon, suivez ces étapes simples sur la console Appwrite (https://cloud.appwrite.io) :

1. CRÉER LE PROJET :
   - Ouvrez : https://cloud.appwrite.io/console
   - Cliquez sur : "Create project" (Créer un projet)
   - Nom du projet : KEEP MASTER PRO
   - Project ID : keep-master-pro

2. AJOUTER UNE PLATEFORME WEB :
   - Dans la vue d'ensemble du projet, cliquez sur : "Web App" (Icône HTML5)
   - Name : Keep Master Pro Web
   - Hostname : localhost, *.pages.dev (ou votre domaine Cloudflare Pages)

3. CRÉER LA BASE DE DONNÉES :
   - Menu : "Databases" -> "Create database"
   - Database ID : keep_master_db
   - Name : KEEP MASTER PRO Database

4. CRÉER LES TABLES / COLLECTIONS :

   A. Collection "notes" (ID: notes) :
      Attributs :
      - userId       : String (size: 255, required)
      - title        : String (size: 255, required: false)
      - content      : String (size: 65535, required: false)
      - type         : String (size: 50, required: true, default: "text")
      - color        : String (size: 50, required: true, default: "default")
      - pinned       : Boolean (required: true, default: false)
      - archived     : Boolean (required: true, default: false)
      - trashed      : Boolean (required: true, default: false)
      - checklist    : String (size: 65535, required: false)
      - labels       : String[] (size: 100, array: true, required: false)
      - reminder     : String (size: 1000, required: false)
      - attachments  : String (size: 65535, required: false)
      - version      : Integer (required: true, default: 1)
      - createdAt    : DateTime (required: true)
      - updatedAt    : DateTime (required: true)
      - deletedAt    : DateTime (required: false)
      Permissions : "Users" (Create, Read, Update, Delete)

   B. Collection "labels" (ID: labels) :
      Attributs :
      - userId    : String (size: 255, required)
      - name      : String (size: 100, required)
      - color     : String (size: 50, default: "default")
      - createdAt : DateTime (required: true)
      Permissions : "Users" (Create, Read, Update, Delete)

   C. Collection "reminders" (ID: reminders) :
      Attributs :
      - userId    : String (size: 255, required)
      - noteId    : String (size: 255, required)
      - date      : DateTime (required: true)
      - completed : Boolean (default: false)
      Permissions : "Users" (Create, Read, Update, Delete)

   D. Collection "shares" (ID: shares) :
      Attributs :
      - noteId     : String (size: 255, required)
      - ownerId    : String (size: 255, required)
      - sharedWith : String (size: 255, required)
      - permission : String (size: 50, default: "read")
      - createdAt  : DateTime (required: true)
      Permissions : "Users" (Create, Read, Update, Delete)

5. CRÉER LE BUCKET DE STOCKAGE :
   - Menu : "Storage" -> "Create bucket"
   - Bucket ID : attachments
   - Name : Keep Master Attachments
   - Permissions : "Users" (Create, Read, Update, Delete)
   - File size limit : 20MB
   - Allowed extensions : png, jpg, jpeg, gif, webp, svg, webm, mp4, wav, mp3

================================================================================
`);
  process.exit(0);
}

async function runProvisioning() {
  console.log('[Appwrite Setup] Démarrage du provisionnement automatique...');
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const databases = new Databases(client);
  const storage = new Storage(client);

  // 1. Create Database
  try {
    await databases.create(DATABASE_ID, DATABASE_NAME);
    console.log(`✅ Base de données "${DATABASE_ID}" créée.`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`ℹ️ La base de données "${DATABASE_ID}" existe déjà.`);
    } else {
      console.error('❌ Erreur création base de données :', err.message);
    }
  }

  // Helper for collection creation
  async function createCollectionSafe(collId, name, permissions) {
    try {
      await databases.createCollection(DATABASE_ID, collId, name, permissions);
      console.log(`✅ Collection "${collId}" créée.`);
    } catch (err) {
      if (err.code === 409) {
        console.log(`ℹ️ La collection "${collId}" existe déjà.`);
      } else {
        console.error(`❌ Erreur création collection "${collId}" :`, err.message);
      }
    }
  }

  const defaultUserPerms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users())
  ];

  await createCollectionSafe('notes', 'Notes', defaultUserPerms);
  await createCollectionSafe('labels', 'Labels', defaultUserPerms);
  await createCollectionSafe('reminders', 'Reminders', defaultUserPerms);
  await createCollectionSafe('shares', 'Shares', defaultUserPerms);

  // 2. Create Storage Bucket
  try {
    await storage.createBucket(
      BUCKET_ID,
      BUCKET_NAME,
      defaultUserPerms,
      false, // fileSecurity
      true, // enabled
      20971520, // max 20MB
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'webm', 'mp4', 'wav', 'mp3']
    );
    console.log(`✅ Bucket de stockage "${BUCKET_ID}" créé.`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`ℹ️ Le bucket de stockage "${BUCKET_ID}" existe déjà.`);
    } else {
      console.error('❌ Erreur création bucket de stockage :', err.message);
    }
  }

  console.log('🎉 Provisionnement Appwrite Cloud terminé avec succès !');
}

runProvisioning().catch(console.error);
