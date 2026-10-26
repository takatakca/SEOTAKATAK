# TAKATAK FIELD STATE — ce que l'agent de terrain a DÉJÀ construit

> **But de ce fichier :** empêcher tout travail refait 15 fois. Si une
> information figure ici avec un ID, un statut « vérifié » et une date, elle
> existe déjà — ne la recréez pas, branchez-vous dessus. Ce fichier est tenu
> par l'agent de terrain (Taktak) ; les agents de code le lisent avant
> toute nouvelle intégration.
>
> Dernière mise à jour : 2026-10-24. Source de vérité prix/produits :
> catalogue maître v3, 198 fiches (local : `contenus-brands/
> catalogue-produits-maitre-v3.md` ; copies dans Drive, voir ci-dessous).

## Règles dures (ne pas contourner)

- **ADD-ONLY** : ne jamais retirer ni rétrograder un accès existant, sur
  Meta, Google ou ailleurs. Exceptions déjà exécutées, ne pas répéter :
  Toby McWire retiré de la Page takatak.ca ; Ashikur Rahman restreint sur
  COMPLEXE HAVANA.
- **Ne jamais inventer** : ni prix, ni heures, ni menus, ni images, ni liens
  de commande, ni courriels. Ce qui manque est listé dans
  « Manquant / à décider », pas deviné.
- **Aucune publicité payante** tant que Matt n'a pas fixé les budgets.
- **Affichage gratuit ≠ garanti** : les fiches gratuites Google sont
  gratuites, l'admissibilité n'assure pas l'affichage. Le produit facture
  la synchronisation et l'optimisation, jamais des apparitions.
- **Terminologie** : « breuvage » partout, jamais « boisson ».
- **Déménagement** : 3583 rue Sainte-Catherine E → **5839 rue Jean-Talon E,
  Montréal, QC H1S 1M4**, partout. Le 3583 est en PAUSE, pas abandonné.
  Ne jamais mettre un magasin actif hors ligne pour un changement.
- **Prix v3** : plateforme = prix d'affiche × 1,20 ; succursale = affiche ;
  Uber livraison = plateforme, Uber ramassage = affiche × 1,15.

## Comptes Google Merchant Center — CRÉÉS (ne pas recréer)

| Marque | Compte MC | ID | Flux | Statut 2026-10-24 |
|---|---|---|---|---|
| Hub On2GO.ca | On2GO.ca | 5881540867 | 198/198 | Vérifié + réclamé, admin matt@takatak.ca |
| PPP Pizzeria | PPP | 5882074745 | 198/198 | Vérifié + réclamé (bloqueur : images) |
| OOEUF | OOEUF | 5881528797 | 198/198 | Flux OK, réclamation en attente du TXT DNS |
| Pi Pita | Pi Pita | 5881714542 | 198/0 | Flux OK, MC en attente d'acceptation |
| Po Poulet | Po Poulet | 5882470697 | 198/0 | Vérifié + réclamé |
| Viennoise | Viennoise | 5882517788 | 198/198 | Code de réclamation à info@viennoise.ca (Webmail cPanel) |
| BMBD | BMBD | 5882817629 | 198 | Créé, audit en cours |
| Taco Mexicano | — | — | 198 prêt | Compte à créer |
| Café Bolon | — | — | 198 prêt | Compte à créer |
| O'Crêpe | — | — | 198 prêt | Compte à créer |
| Nutrition Shake | — | — | 198 prêt | Compte à créer |
| Délices d'Aden | — | — | 198 prêt | Compte à créer |

**Bloqueur connu, tous comptes** : AUCUN `g:image_link` dans les flux
(les images produits manquent) — c'est le frein principal de visibilité
Shopping. Ne pas « corriger » en inventant des URLs d'images.

**Flux déposés** : Drive « TAKATAK — Sites & Flux par marque », un dossier
par marque, sous-dossier « Flux Merchant Center » (XML + CSV quand il
existe). Originaux locaux : `merchant-center/marques/
flux-google-merchant-<marque>.xml`.

## Google Analytics / pixels — EXISTANTS

- GA4 : Po Poulet **G-7BFBQEJ4DP** · Pi Pita **G-95K5HSKD28** ·
  OOEUF **G-94EPJCY0W8** · Viennoise **G-6X78WEJ4LJ** · BMBD compte
  335427331. Café Bolon, Taco, O'Crêpe, Nutrition Shake, Délices : **pas
  encore de GA4 — à créer, pas à inventer**.
- Pixel Meta du groupe : **1633696381578717** (« Groupe Takatak - Pixel »),
  installé sur les 3 nouveaux sites (bolon, pipita, ooeuf).
- Pixels Rapide 2 Nette : 687337046023500 + 705121384032100, « No data
  connected » (site r2nette.ca, code Pixel+CAPI prêt, push bloqué — voir
  « Blocages »).

## Google Business Profile — CRÉÉS (ne pas recréer)

- **Saint-Léonard (5839 Jean-Talon E), 7/7** : Café Bolon (vérifié),
  Nutrition Shake (vérifié), Pi Pita, OOEUF, Po Poulet, PPP SL, Taco
  (heures vides — inconnues, à obtenir, pas à inventer). Non vérifiés =
  invisibles jusqu'aux vérifications vidéo de Matt.
- **NDG (6280 Somerled), 9/9 traités** : Café Bolon NDG (vérifié),
  BMBD NDG (vérifié), Gâteau Montréal (vérification en traitement),
  Nutrition Shake NDG **SUSPENDU — ne pas toucher**, OOEUF NDG, Pi Pita
  NDG, Po Poulet NDG, PPP NDG, Taco NDG (partiel). O'Crêpe NDG créé
  (6284 Somerled).
- **AUCUN profil au 5839 pour BMBD ni Gâteaux/Viennoise** — décision de
  Matt en attente, ne pas créer.
- **Accès partenaire** : matt@takatak.ca (= takatak.agency@gmail.com)
  Admin vérifié sur hub On2GO, Po Poulet, OOEUF ; GA4 Administrateur
  OOEUF + Pi Pita. Les invitations pour matt@takatak.ca arrivent dans
  takatak.ca@gmail.com.

## Sites web de marques — CONSTRUITS (paquets statiques zéro-build)

- **bolon.ca, pipita.ca, ooeuf.ca** : 198 produits / 19 catégories chacun,
  prix d'affiche, lien Clover en premier, cartes d'emplacements séparées,
  JSON-LD Restaurant, pixel Meta du groupe, GA4 (pipita, ooeuf ; bolon en
  attente de son GA4). Zips dans Drive (dossier « Site web » de chaque
  marque) — téléversement cPanel File Manager manuel par Matt.
- **pppmtl.com** : 403 accueil / 404 /pickup-orders depuis le 2026-10-23,
  diagnostic en cours — ne pas reconstruire par-dessus sans le diagnostic.
- **Données structurées Product/Offer par item : ABSENTES** sur les 3
  nouveaux sites — c'est une tâche de code (voir le guide de connexion),
  pas une reconstruction de site.

## Plateformes de livraison — ÉTAT TERRAIN (ne pas resynchroniser à l'aveugle)

- **DoorDash** (groupe Quadro Holdings LTEE) : magasin maître 27982486
  (Po Poulet NDG) synchronisé 173/173 pré-v3 ; passe delta v3 en cours.
  Famille 3359xxxx (OOEUF/BMBD/Pi Pita) toute au 5839. Menus scopés par
  « business » — aucune copie libre-service entre magasins.
- **Uber Eats** : 17 magasins (10 ouverts / 3 hors ligne / 4 fermés),
  aucun au 3583 ; synchro v3 : pilote PPP NDG ✔, nº 1 BMBD SL ✔,
  nº 2 Gâteaux SL ✔, nº 3 Nutri Shake SL en finition, puis nº 4 BMBD NDG.
  Aucune copie de menu entre magasins — tout est manuel.
- **Clover** : seul marchand actif On2GO.CA YJ4W50YPJQSQ1 ; 17 menus de
  canal DoorDash publiés ; groupes TRIO (+5,00 $) / COMBO (+7,00 $)
  optionnels sur plats principaux seulement.

## Manquant / à décider (par Matt, pas par les agents)

- TXT DNS Google en attente (pipita, ooeuf, popoulet, viennoise, bmbd +
  valeurs à venir) ; codes MC Webmail cPanel (Viennoise, OOEUF) ;
  acceptations MC (PPP, Pi Pita) ; téléversements cPanel des 3 sites ;
  vérifications vidéo GBP ; infos bancaires Uber à confirmer ;
  ~307 items hérités DoorDash et doublons Uber (jamais supprimés sans
  son mot) ; heures Taco ; domaine canonique bolon.ca vs boloncafe.ca.
- Fichier maître vivant : `fichier-maitre-blocages.md` (côté agent de
  terrain) — le consulter avant tout branchement.

## Blocages techniques connus

- **GitHub App « Contents » en lecture seule** : les push sont bloqués
  (même blocage que Rapide r2neet). Basculer l'app en Read and write
  pour débloquer les contributions.
- **Yelp** : blocage DataDome IP persistant. **Zomato** : fermé au Canada.
- **Meta** : bouton d'action Rapide figé sur Setmore (bug Meta/Page,
  ~30 essais) — seul un clic manuel de Matt peut le régler.

## Protocole de consignation — OBLIGATOIRE pour chaque agent (Matt, 2026-10-24)

- **Tout le travail se consigne dans le Drive takatak.ca@gmail.com, dossier
  MAIN** (voir la structure dans le registre, section « Drive ») :
  - le **journal vivant** : Google Doc « 00 — JOURNAL — État en direct »,
    premier fichier de MAIN (état actuel + 10 dernières nouvelles) ;
  - le **fichier du jour** dans MAIN → « Journal quotidien » :
    `YYYY-MM-DD.md`, détail complet.
- **Chaque entrée est signée** : `HH:MM — [nom de l'agent · fenêtre ou
  session] — fait`. Une erreur est marquée ⚠️ ERREUR avec le nom de
  l'agent — c'est le mécanisme de contrôle : on sait qui a fait quoi, et
  qui arrêter.
- **Chaque livrable va dans MAIN → dossier du client → sa catégorie**
  (Site web, Flux Merchant Center, etc.), avec le bon site web et le bon
  nom de fichier — jamais en vrac à la racine, jamais dans un autre
  compte.
- **Avant toute création**, lire le registre du travail fait (MAIN →
  « 00 — Opérations TAKATAK » → « Registre — Travail fait ») et vérifier
  l'état vivant de ce qui existe déjà : on ne refait jamais un travail
  déjà fait.
