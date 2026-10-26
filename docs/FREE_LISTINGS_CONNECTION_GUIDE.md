# FREE LISTINGS CONNECTION GUIDE — ce que les agents de code doivent brancher

> Module réutilisable dans TAKATAK V1 (jamais un système par entreprise).
> SEOTAKATAK reste le moteur SEO qui l'expose. Lire d'abord
> `TAKATAK_FIELD_STATE.md` : tout ce qui y est marqué « créé » ou
> « vérifié » existe déjà et ne doit PAS être refait.
>
> Contexte : les fiches gratuites Google (Popular Products, More Products,
> Fast Pickup / Delivery, In Stores Nearby, Deals On) sont gratuites, mais
> l'admissibilité n'assure pas l'affichage. Le module vend la
> synchronisation et l'optimisation, jamais des apparitions.

## Fondation existante — s'appuyer dessus, ne pas la dupliquer

| Brique | Où | État |
|---|---|---|
| Isolation multi-client + memberships | takatak-v1, Phase 15A | Terminée, testée (15/15 + 16/16) — le tenant = le commerçant |
| Modèles BusinessBrand / Client / ServiceInstance | takatak-v1 | Existent |
| Registre de sites par tenant + défi DNS TXT | SEOTAKATAK | Existent — réutiliser pour rattacher domaine ↔ MC |
| Import Search Console (clics, impressions, position) | SEOTAKATAK | Existent — moitié « performance » du dashboard |
| Module Local Listings (listings, citations, reviews, photos, snapshots) | takatak-v1 Phase 11 | Fondation seulement, données démo, QMAPS et Google Business NON connectés |
| Module Web / Domaines (DomainAsset, DnsRecord, SslCertificate) | takatak-v1 Phase 7 | Existent — vérification de domaine |
| Règle d'honnêteté | takatak-v1 | Aucune intégration affichée « Connectée » sans identifiants réels + un appel API réel réussi — appliquer au MC |

## À construire — dans l'ordre

### 1. Adaptateur Google Merchant Center (le morceau central, absent des 2 dépôts)
- OAuth Google **par commerçant** (un compte MC par marque, jamais un
  compte partagé) ; tokens stockés côté serveur, jamais au navigateur.
- Content API for Shopping : lecture comptes, soumission et statut des
  flux, diagnostics produits (approuvés / refusés / en attente), erreurs.
- Statut de connexion honnête : `not_configured` → `configured_untested`
  → `connected` (seulement après un appel réel réussi) / `error` /
  `disabled` — même pattern que les adaptateurs Metricool et Upmind.
- Premier branchement : les 11 comptes et 11 flux listés dans
  `TAKATAK_FIELD_STATE.md` (IDs MC, flux 198 produits, Drive). Ne pas
  recréer de comptes : rattacher les existants par OAuth du propriétaire
  (comptes Gmail de marque), puis importer leurs flux et diagnostics.
- Bloqueur à traiter en premier : les flux n'ont aucun `g:image_link` —
  le module doit signaler les produits sans image comme « non admissibles
  visibilité » au lieu d'inventer des URLs.

### 2. Moteur de catalogue (absent des 2 dépôts)
- Source de vérité : catalogue maître v3, 198 fiches (prix d'affiche ;
  plateforme = affiche × 1,20 ; succursale = affiche ; Uber livraison =
  plateforme, ramassage = affiche × 1,15).
- Synchronisation : catalogue → flux MC par marque, avec diff (prix /
  noms / nouveaux / retirés) et journal par marque. Rien n'est supprimé
  sans décision explicite du commerçant (même règle que les items
  hérités DoorDash).
- Les 3 promos « emporter seulement » sont exclues du vendable en ligne.

### 3. Données structurées Product + Offer sur les sites (à ajouter)
- Les sites bolon / pipita / ooeuf ont le JSON-LD Restaurant mais PAS de
  Product/Offer par item : générer un bloc Product (nom, prix, devise
  CAD, disponibilité, lien Clover) par produit, depuis le même catalogue
  v3 que les flux — une seule source, pas deux vérités.
- pppmtl.com est en 403/404 : attendre le diagnostic terrain avant tout
  ajout de balises.

### 4. Tableau de bord produits (dans SEOTAKATAK, exposé dans V1)
- Par commerçant : produits admissibles, erreurs de flux, statut MC,
  performance (diagnostics MC + performance Shopping de Search Console).
- Libellés obligatoires : « admissible », jamais « garanti » ; toute
  donnée démo étiquetée comme telle, jamais présentée comme réelle.
- Ne pas remplacer les pages `/dashboard/seo` existantes de V1 :
  intégration par PR séparée, selon les règles du coordinateur V1.

### 5. Lien Google Business Profile + QMAPS (fondation seulement aujourd'hui)
- QMAPS n'est aujourd'hui qu'un nom d'adaptateur : construire le
  connecteur réel (ou documenter honnêtement son absence) avant de
  promettre une liaison.
- Les profils GBP existent côté Google (Saint-Léonard 7/7, NDG 9/9) mais
  ne sont reliés à aucun dépôt : le rattachement passe par l'OAuth du
  propriétaire de chaque profil, jamais par des identifiants partagés.
- Ne pas créer de profils BMBD / Gâteaux au 5839 : décision de Matt en
  attente.

### 6. Inventaire local (le morceau le plus neuf, phase C)
- Flux d'inventaire local par magasin (disponibilité + prix en succursale)
  pour « In Stores Nearby » et « Fast Pickup / Delivery ». N'existe
  nulle part aujourd'hui — à spécifier avec les données Clover/POS avant
  de coder.

## Contraintes de livraison

- Production V1 toujours bloquée sur la vérification staging (E2E
  Supabase live) ; SEOTAKATAK non déployé (Supabase + Coolify à
  provisionner, migrations 0001→0005 dans l'ordre, secrets en runtime
  seulement). Ne pas présenter le module comme « en production » avant
  ces deux portes.
- Push GitHub bloqué tant que l'app GitHub n'est pas en Read and write
  sur « Contents » — coordonner avec le propriétaire avant toute PR.
- Chaque action importante devient un job traçable (règle V1) ; chaque
  page affiche le système, la logique vit dans `src/lib`.
- Tests : un test d'isolation tenant (un commerçant ne voit jamais les
  produits d'un autre) est obligatoire avant tout statut « connected ».

## Critère d'acceptation du module

Un commerçant est « connecté » quand : (1) son OAuth MC réussit avec un
appel réel, (2) son flux existant est importé avec ses diagnostics
réels, (3) ses produits apparaissent dans le dashboard avec leur statut
d'admissibilité réel, (4) le test d'isolation tenant passe. Tout le
reste est « en préparation », jamais « connecté ».
