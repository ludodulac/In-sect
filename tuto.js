(function() {
'use strict';

/* ================================================================
   COULEURS COLONIES
================================================================ */
const COL = {
  yellow: '#D4A010',
  green:  '#22B84A',
  blue:   '#3A80E8',
  red:    '#E82838',
};
const COL_GLOW = {
  yellow: 'rgba(240,192,48,.6)',
  green:  'rgba(48,208,96,.5)',
  blue:   'rgba(64,144,255,.5)',
  red:    'rgba(255,48,80,.45)',
};
const SYM = {
  queen:'reine_guepe_512.png', spider:'araignee_512.png', fly:'mouche_512.png', beetle:'scarabee_512.png', lady:'coccinelle_512.png', ant:'fourmi_512.png',
};

/* ================================================================
   SLIDES
================================================================ */
const SLIDES = [

  /* 0 — INTRO */
  {
    type: 'intro',
    title: `IN-SECT — L'Échiquier des Colonies`,
    desc: `<b>4 colonies d'insectes</b> s'affrontent sur un plateau 9×9.<br>
           Chaque colonie a <span class="th-gold">9 pièces</span> aux pouvoirs différents.<br>
           <b>Tuez la Reine adverse</b> ou <b>encerclez-la</b> pour gagner.`,
  },

  /* 1 — GUÊPE REINE */
  {
    type: 'piece', sym: 'reine_guepe_512.png', name: `La Guêpe Reine`,
    title: `La Reine — Pièce maîtresse`,
    desc: `Se déplace en <b>dame aux échecs</b> — toutes directions, toutes distances.
           Quand elle <span class="th-red">tue une pièce</span>, c'est <b>vous</b> qui posez la dépouille 💀 sur n'importe quelle case libre.
           <span class="th-red">Si elle meurt, votre colonie est éliminée.</span> Gardez-la en vie !`,
    tags: [{cls:'kill',txt:`Dame aux échecs`},{cls:'spec',txt:`Vous placez la dépouille 💀`},{cls:'warn',txt:`Sa mort = partie perdue`}],
    boardSize: 5,
    anim: buildQueenAnim(),
  },

  /* 2 — ARAIGNÉE */
  {
    type: 'piece', sym: 'araignee_512.png', name: `L'Araignée Assassine`,
    title: `L'Araignée — L'Assassine`,
    desc: `Se déplace en <b>dame aux échecs</b>.
           Elle tue sa cible et <span class="th-gold">prend sa place</span> sur le plateau.
           La <span class="th-gold">dépouille 💀 reste à la case de départ</span> de l'Araignée.`,
    tags: [{cls:'kill',txt:`Prend la place de la cible`},{cls:'spec',txt:`Dépouille 💀 reste au départ`},{cls:'warn',txt:`Accès Nid Sacré interdit`}],
    boardSize: 5,
    anim: buildSpiderAnim(),
  },

  /* 3 — MOUCHE */
  {
    type: 'piece', sym: 'mouche_512.png', name: `La Mouche Journaliste`,
    title: `La Mouche — Frappe en zone`,
    desc: `Se pose sur une <b>case vide</b>, puis choisit <b>l'une des deux options :</b><br>
           <span class="th-green">Option 1 — Attaque les 4 cases ↑↓←→</span><br>
           <span class="th-gold">Option 2 — Attaque les 4 diagonales ↗↘↙↖</span><br>
           Toutes les pièces ennemies de la direction choisie sont <b>tuées en même temps !</b>`,
    tags: [{cls:'move',txt:`Se pose sur case vide`},{cls:'kill',txt:`Option 1 : ↑↓←→  |  Option 2 : ↗↘↙↖`},{cls:'spec',txt:`Tue plusieurs ennemis d'un coup`}],
    boardSize: 5,
    anim: buildFlyAnim(),
  },

  /* 4 — SCARABÉE */
  {
    type: 'piece', sym: 'scarabee_512.png', name: `Le Scarabée Déplaceur de Dépouilles`,
    title: `Le Scarabée — Maître des dépouilles`,
    desc: `Se déplace en <b>dame aux échecs</b>.
           Il va chercher une dépouille 💀 et la <span class="th-gold">redépose sur n'importe quelle case libre</span> sur le plateau.
           <span class="th-red">Sans lui, votre Reine peut être encerclée et piégée.</span>`,
    tags: [{cls:'move',txt:`Dame aux échecs`},{cls:'spec',txt:`Déplace les dépouilles 💀`},{cls:'warn',txt:`Vital — évite l'encerclement`}],
    boardSize: 5,
    anim: buildBeetleAnim(),
  },

  /* 5 — COCCINELLE */
  {
    type: 'piece', sym: 'coccinelle_512.png', name: `La Coccinelle Déplaceuse de Vivant`,
    title: `La Coccinelle — Déplace sans tuer`,
    desc: `Se déplace en <b>dame aux échecs</b> et atterrit <b>sur une pièce ennemie vivante</b>.
           Elle la <span class="th-gold">redépose sur n'importe quelle case libre</span> — sans la tuer.
           Parfait pour <span class="th-green">briser une formation ennemie</span>.`,
    tags: [{cls:'spec',txt:`Va sur la pièce ennemie`},{cls:'move',txt:`Redépose n'importe où`},{cls:'kill',txt:`Pas de meurtre`}],
    boardSize: 5,
    anim: buildLadybugAnim(),
  },

  /* 6 — FOURMI */
  {
    type: 'piece', sym: 'fourmi_512.png', name: `Les Fourmis Soldates`,
    title: `Les Fourmis — 4 soldates`,
    desc: `Portée de <b>2 cases maximum</b> dans toutes les directions.
           Elle se déplace <b>directement sur la pièce ennemie</b> et la tue.
           <span class="th-red">Interdit d'attaquer une Reine sur le Nid Sacré.</span> Vous en avez <b>4</b> !`,
    tags: [{cls:'kill',txt:`Portée 2 cases — va sur la cible`},{cls:'warn',txt:`Reine sur le Nid Sacré : immunisée`},{cls:'spec',txt:`×4 dans votre colonie`}],
    boardSize: 6,
    anim: buildAntAnim(),
  },

  /* 7 — ENJEUX */
  {
    type: 'stakes',
    title: `Ce qu'il faut savoir`,
    desc: `Les règles qui font la différence :`,
    stakes: [
      { ico:'👑', txt:`<b>Nid Sacré</b> — La Reine qui s'y pose rejoue après chaque adversaire. Les Fourmis ne peuvent pas l'y attaquer.` },
      { ico:'💀', txt:`<b>Dépouilles</b> — Les pièces tuées restent sur le plateau et bloquent les trajectoires. Seul le Scarabée peut les bouger.` },
      { ico:'⚔️', txt:`<b>Encerclement</b> — Entourez la Reine ennemie de dépouilles. Elle est piégée si elle n'a plus de Scarabée.` },
      { ico:'🔄', txt:`<b>Conversion</b> — Tuer la Reine adverse vous donne toutes ses pièces encore en vie.` },
      { ico:'🎯', txt:`<b>L'essentiel</b> — Votre Reine est votre vie. Si elle tombe, vous perdez.` },
    ],
  },

];

/* ================================================================
   ANIMATIONS
================================================================ */

/* helper : dépouille = emoji grisé de la pièce */
function corpseEmoji(sym) { return sym; } // on affiche l'emoji en gris via CSS

function buildQueenAnim() {
  return {
    piece:{r:2,c:2,color:'yellow',sym:'reine_guepe_512.png'},
    enemy:{r:0,c:4,color:'red',sym:'fourmi_512.png'},  // fourmi ennemie
    frames:[
      // Montre portée complète dame + cible en rouge
      {delay:500, label:{text:'Parcourt lignes et diagonales sans limite de portée.', type:'move'}, cells:[
        {r:0,c:0,cls:'t-move'},{r:1,c:1,cls:'t-move'},{r:3,c:3,cls:'t-move'},{r:4,c:4,cls:'t-move'},
        {r:1,c:3,cls:'t-move'},{r:3,c:1,cls:'t-move'},{r:4,c:0,cls:'t-move'},
        {r:0,c:2,cls:'t-move'},{r:1,c:2,cls:'t-move'},{r:3,c:2,cls:'t-move'},{r:4,c:2,cls:'t-move'},
        {r:2,c:0,cls:'t-move'},{r:2,c:1,cls:'t-move'},{r:2,c:3,cls:'t-move'},{r:2,c:4,cls:'t-move'},
        {r:0,c:4,cls:'t-kill'},
      ], piece:null},
      // Reine va DIRECTEMENT sur la fourmi en un seul trait (0,4)
      {delay:1800, label:{text:'Élimine la cible puis occupe sa case.', type:'kill'}, cells:[], piece:{r:0,c:4}, killEnemy:true},
      // Montre où on peut poser la dépouille
      {delay:900, label:{text:'Vous choisissez où repositionner la dépouille.', type:'corpse'}, cells:[
        {r:0,c:0,cls:'t-necro'},{r:0,c:1,cls:'t-necro'},{r:0,c:2,cls:'t-necro'},{r:0,c:3,cls:'t-necro'},
        {r:1,c:0,cls:'t-necro'},{r:1,c:1,cls:'t-necro'},{r:1,c:2,cls:'t-necro'},{r:1,c:3,cls:'t-necro'},{r:1,c:4,cls:'t-necro'},
        {r:2,c:0,cls:'t-necro'},{r:2,c:1,cls:'t-necro'},{r:2,c:2,cls:'t-necro'},{r:2,c:3,cls:'t-necro'},{r:2,c:4,cls:'t-necro'},
        {r:3,c:0,cls:'t-necro'},{r:3,c:1,cls:'t-necro'},{r:3,c:2,cls:'t-necro'},{r:3,c:3,cls:'t-necro'},{r:3,c:4,cls:'t-necro'},
        {r:4,c:0,cls:'t-necro'},{r:4,c:1,cls:'t-necro'},{r:4,c:2,cls:'t-necro'},{r:4,c:3,cls:'t-necro'},{r:4,c:4,cls:'t-necro'},
      ], piece:null},
      // Pose la dépouille en (3,1)
      {delay:1500, label:{text:'Dépouille repositionnée sur n\'importe quelle case libre.', type:'corpse', dur:2000}, cells:[], piece:null, placeCorpse:{r:3,c:1,sym:'fourmi_512.png'}},
      // Reset
      {delay:2000, cells:[], piece:{r:2,c:2}, resetEnemy:true, removeCorpse:true},
    ],
  };
}

function buildSpiderAnim() {
  return {
    piece:{r:2,c:1,color:'yellow',sym:'araignee_512.png'},
    enemy:{r:2,c:4,color:'blue',sym:'coccinelle_512.png'},  // coccinelle ennemie
    frames:[
      // Montre portée dame
      {delay:500, label:{text:'Parcourt lignes et diagonales sans limite de portée.', type:'move'}, cells:[
        {r:0,c:1,cls:'t-move'},{r:1,c:1,cls:'t-move'},{r:3,c:1,cls:'t-move'},{r:4,c:1,cls:'t-move'},
        {r:2,c:0,cls:'t-move'},{r:2,c:2,cls:'t-move'},{r:2,c:3,cls:'t-move'},
        {r:0,c:3,cls:'t-move'},{r:1,c:2,cls:'t-move'},{r:1,c:0,cls:'t-move'},
        {r:3,c:0,cls:'t-move'},{r:3,c:2,cls:'t-move'},{r:4,c:3,cls:'t-move'},
        {r:2,c:4,cls:'t-kill'},
      ], piece:null},
      // Araignée fonce sur la coccinelle
      {delay:1800, label:{text:'Élimine la cible puis occupe immédiatement sa case.', type:'kill'}, cells:[], piece:{r:2,c:4}, killEnemy:true, corpseAt:{r:2,c:1,sym:'coccinelle_512.png'}},
      // Montre la dépouille à la case de départ
      {delay:900, label:{text:'La dépouille reste sur sa position d\'origine.', type:'corpse'}, cells:[{r:2,c:1,cls:'t-necro'}], piece:null},
      // Reset
      {delay:2200, cells:[], piece:{r:2,c:1}, resetEnemy:true, removeCorpse:true},
    ],
  };
}

function buildFlyAnim() {
  // ═══ SCÉNARIO MOUCHE — sans traversée de pièce ═══
  //
  // PHASE ORTHO : ennemis aux 4 cases ortho de (2,2) → (1,2)(2,1)(2,3)(3,2)
  //   Pour atteindre (2,2) SANS traverser, la mouche entre en DIAGONALE
  //   Position départ : (4,4) — diag libre ↖ : (3,3)→(2,2) ✓ (aucun ennemi sur cette diag)
  //   Cases accessibles depuis (4,4) : diag ↖ libre jusqu'à (2,2), tout le reste bloqué
  //
  // PHASE DIAG : ennemis aux 4 diagonales de (2,2) → (1,1)(1,3)(3,1)(3,3)
  //   Pour atteindre (2,2) SANS traverser, la mouche entre ORTHOGONALEMENT
  //   Position départ : (4,2) — ortho ↑ libre : (3,2)→(2,2) ✓ (aucun ennemi sur cette colonne)
  //   Cases accessibles depuis (4,2) : col2 libre jusqu'à (2,2)
  return {
    piece:{r:4,c:4,color:'yellow',sym:'mouche_512.png'},
    enemies:[
      {r:1,c:2,color:'red',   sym:'fourmi_512.png'}, // ortho haut
      {r:2,c:1,color:'blue',  sym:'araignee_512.png'}, // ortho gauche
      {r:2,c:3,color:'green', sym:'reine_guepe_512.png'}, // ortho droite
      {r:3,c:2,color:'red',   sym:'scarabee_512.png'}, // ortho bas
    ],
    enemiesDiag:[
      {r:1,c:1,color:'red',   sym:'fourmi_512.png'},
      {r:1,c:3,color:'blue',  sym:'araignee_512.png'},
      {r:3,c:1,color:'green', sym:'reine_guepe_512.png'},
      {r:3,c:3,color:'red',   sym:'scarabee_512.png'},
    ],
    flyPhase: true,
    frames:[
      // ── PHASE ORTHO : mouche en (4,4), entre en DIAGONALE ↖ ──
      // Montre les cases accessibles depuis (4,4) en diag ↖ : (3,3) et (2,2)
      // (les ortho et autres diag sont bloqués par les ennemis)
      {delay:600, label:{text:'Se déplace vers une case vide.', type:'move'}, cells:[
        {r:3,c:3,cls:'t-move'}, // diag ↖ case 1
        {r:2,c:2,cls:'t-move'}, // diag ↖ case 2 — destination
      ], piece:null, showArrow:{fr:4,fc:4,tr:2,tc:2,type:'move'}},
      // Se pose en (2,2) par la diagonale — sans traverser d'ennemi
      {delay:1800, label:{text:'Se pose sur la case vide choisie.', type:'move'}, cells:[], piece:{r:2,c:2}},
      // Choisit ORTHO — montre les 4 ennemis orthogonaux en rouge
      {delay:800, label:{text:'Option 1 — attaque orthogonale ↑↓←→', type:'kill'}, cells:[
        {r:1,c:2,cls:'t-kill'},{r:2,c:1,cls:'t-kill'},{r:2,c:3,cls:'t-kill'},{r:3,c:2,cls:'t-kill'},
      ], piece:null, showOrthoLabel:true},
      // Kill ortho
      {delay:1500, label:{text:'Toutes les pièces ennemies touchées sont éliminées.', type:'kill', dur:1800}, cells:[], piece:null, killOrtho:true},
      // Reset, mouche revient en (4,4), swap vers phase diag
      {delay:1400, cells:[], piece:{r:4,c:4}, resetFlyPhase:true},

      // ── PHASE DIAG ──
      {delay:800, label:{text:'Se déplace vers une case vide.', type:'move'}, cells:[], piece:{r:4,c:2}, swapToDiag:true, flyRepos:true},
      // Montre les cases accessibles depuis (4,2) en ortho ↑
      {delay:800, cells:[
        {r:3,c:2,cls:'t-move'},
        {r:2,c:2,cls:'t-move'},
      ], piece:null, showArrow:{fr:4,fc:2,tr:2,tc:2,type:'move'}},
      // Se pose en (2,2) par l'ortho
      {delay:1800, label:{text:'Se pose sur la case vide choisie.', type:'move'}, cells:[], piece:{r:2,c:2}},
      // Choisit DIAG
      {delay:800, label:{text:'Option 2 — attaque diagonale ↗↘↙↖', type:'kill'}, cells:[
        {r:1,c:1,cls:'t-kill'},{r:1,c:3,cls:'t-kill'},{r:3,c:1,cls:'t-kill'},{r:3,c:3,cls:'t-kill'},
      ], piece:null, showDiagLabel:true},
      // Kill diag
      {delay:1500, label:{text:'Toutes les pièces ennemies touchées sont éliminées.', type:'kill', dur:1800}, cells:[], piece:null, killDiag:true},
      // Reset complet
      {delay:1500, cells:[], piece:{r:4,c:4}, resetAllFly:true},
    ],
  };
}

function buildBeetleAnim() {
  // Scarabée en (3,1), dépouille en (1,2)
  // Déplacements légaux (dame aux échecs) depuis (3,1) :
  //   Ortho col1↑ : (2,1),(1,1),(0,1)
  //   Ortho col1↓ : (4,1)
  //   Ortho ligne3→ : (3,2),(3,3),(3,4)
  //   Ortho ligne3← : (3,0)
  //   Diag NE ↗ : (2,2) puis dépouille en (1,2) bloque la diag — (2,2) accessible
  //               [note: (1,2) est sur la même colonne, pas sur la diag NE]
  //               diag NE : (2,2),(1,3),(0,4)
  //   Diag NO ↖ : (2,0),(1,-1)→hors → (2,0) seulement
  //   Diag SE ↘ : (4,2)
  //   Diag SO ↙ : (4,0)
  //   La dépouille (1,2) est accessible en ortho depuis (1,1) → non, scarabée va en dame
  //   En ligne droite col2 depuis (3,1) : pas sur même col
  //   En diag depuis (3,1) vers (1,2) : dr=-2,dc=+1 → pas une diag 45°
  //   En ortho depuis (3,1) vers (1,2) : pas même ligne ni colonne
  //   → la dépouille (1,2) est accessible en : depuis (3,1) aller (2,1) puis (1,1)... non c'est pas dame
  //   RECALCUL : dame depuis (3,1) vers (1,2) : dr=-2, dc=+1 → ratio non 1:1 → pas accessible en dame !
  //   Déplaçons scarabée en (3,0) et dépouille en (0,3) pour une diag propre
  //   Scarabée (2,0), dépouille (0,2) : dr=-2,dc=+2 → diag ↗ (1,1),(0,2)✓ ACCESSIBLE
  return {
    piece:{r:2,c:0,color:'yellow',sym:'scarabee_512.png'},
    corpse:{r:0,c:2,sym:'fourmi_512.png'}, // dépouille fourmi — accessible en diag ↗
    frames:[
      // Montre les cases accessibles (dame depuis (2,0)) + dépouille en surbrillance spéciale
      {delay:500, label:{text:'Parcourt lignes et diagonales sans limite de portée.', type:'move'}, cells:[
        {r:1,c:0,cls:'t-move'},{r:0,c:0,cls:'t-move'},
        {r:3,c:0,cls:'t-move'},{r:4,c:0,cls:'t-move'},
        {r:2,c:1,cls:'t-move'},{r:2,c:2,cls:'t-move'},{r:2,c:3,cls:'t-move'},{r:2,c:4,cls:'t-move'},
        {r:1,c:1,cls:'t-move'},
        {r:0,c:2,cls:'t-special'},
        {r:3,c:1,cls:'t-move'},{r:4,c:2,cls:'t-move'},
      ], piece:null},
      // Va sur la dépouille (0,2) en diagonale
      {delay:1800, label:{text:'Récupère la dépouille.', type:'special'}, cells:[], piece:{r:0,c:2}},
      // Montre toutes les cases libres où poser la dépouille
      {delay:700, label:{text:'La repositionne sur n\'importe quelle case disponible.', type:'corpse'}, cells:[
        {r:0,c:0,cls:'t-necro'},{r:0,c:1,cls:'t-necro'},{r:0,c:3,cls:'t-necro'},{r:0,c:4,cls:'t-necro'},
        {r:1,c:0,cls:'t-necro'},{r:1,c:1,cls:'t-necro'},{r:1,c:2,cls:'t-necro'},{r:1,c:3,cls:'t-necro'},{r:1,c:4,cls:'t-necro'},
        {r:2,c:0,cls:'t-necro'},{r:2,c:1,cls:'t-necro'},{r:2,c:2,cls:'t-necro'},{r:2,c:3,cls:'t-necro'},{r:2,c:4,cls:'t-necro'},
        {r:3,c:0,cls:'t-necro'},{r:3,c:1,cls:'t-necro'},{r:3,c:2,cls:'t-necro'},{r:3,c:3,cls:'t-necro'},{r:3,c:4,cls:'t-necro'},
        {r:4,c:0,cls:'t-necro'},{r:4,c:1,cls:'t-necro'},{r:4,c:2,cls:'t-necro'},{r:4,c:3,cls:'t-necro'},{r:4,c:4,cls:'t-necro'},
      ], piece:null},
      // Dépose la dépouille en (4,4)
      {delay:1800, label:{text:'Essentiel pour éviter l\'encerclement de la Reine.', type:'corpse', dur:2000}, cells:[], piece:null, moveCorpse:{r:4,c:4}},
      // Reset
      {delay:2000, cells:[], piece:{r:2,c:0}, resetCorpse:true},
    ],
  };
}

function buildLadybugAnim() {
  return {
    piece:{r:2,c:1,color:'yellow',sym:'coccinelle_512.png'},
    enemy:{r:2,c:3,color:'red',sym:'mouche_512.png'}, // mouche ennemie
    frames:[
      // Montre portée dame
      {delay:500, label:{text:'Parcourt lignes et diagonales sans limite de portée.', type:'move'}, cells:[
        {r:0,c:1,cls:'t-move'},{r:1,c:1,cls:'t-move'},{r:3,c:1,cls:'t-move'},{r:4,c:1,cls:'t-move'},
        {r:2,c:0,cls:'t-move'},{r:2,c:2,cls:'t-move'},
        {r:0,c:3,cls:'t-move'},{r:1,c:0,cls:'t-move'},{r:1,c:2,cls:'t-move'},
        {r:3,c:0,cls:'t-move'},{r:3,c:2,cls:'t-move'},{r:4,c:3,cls:'t-move'},
        {r:2,c:3,cls:'t-special'},
      ], piece:null},
      // Va directement sur la mouche (2,3)
      {delay:1800, label:{text:'Atterrit directement sur la pièce ennemie vivante.', type:'special'}, cells:[], piece:{r:2,c:3}},
      // Montre toutes les cases vides pour redéposer
      {delay:700, label:{text:'La repositionne sur une autre case sans l\'éliminer.', type:'corpse'}, cells:[
        {r:0,c:0,cls:'t-necro'},{r:0,c:1,cls:'t-necro'},{r:0,c:2,cls:'t-necro'},{r:0,c:3,cls:'t-necro'},{r:0,c:4,cls:'t-necro'},
        {r:1,c:0,cls:'t-necro'},{r:1,c:1,cls:'t-necro'},{r:1,c:2,cls:'t-necro'},{r:1,c:3,cls:'t-necro'},{r:1,c:4,cls:'t-necro'},
        {r:2,c:0,cls:'t-necro'},{r:2,c:1,cls:'t-necro'},{r:2,c:2,cls:'t-necro'},{r:2,c:4,cls:'t-necro'},
        {r:3,c:0,cls:'t-necro'},{r:3,c:1,cls:'t-necro'},{r:3,c:2,cls:'t-necro'},{r:3,c:3,cls:'t-necro'},{r:3,c:4,cls:'t-necro'},
        {r:4,c:0,cls:'t-necro'},{r:4,c:1,cls:'t-necro'},{r:4,c:2,cls:'t-necro'},{r:4,c:3,cls:'t-necro'},{r:4,c:4,cls:'t-necro'},
      ], piece:null},
      // Redépose la mouche en (0,0)
      {delay:1500, label:{text:'Permet de briser les formations adverses.', type:'special', dur:2000}, cells:[], piece:null, teleportEnemy:{r:0,c:0}},
      // Reset
      {delay:2000, cells:[], piece:{r:2,c:1}, resetEnemy:true},
    ],
  };
}

function buildAntAnim() {
  // Grille 6×6 — fourmi en (3,3), ennemi en (1,3) (2 cases au nord)
  // La portée limitée EST VISIBLE : tout le contour extérieur reste vide
  return {
    piece:{r:3,c:3,color:'yellow',sym:'fourmi_512.png'},
    enemy:{r:1,c:3,color:'blue',sym:'scarabee_512.png'},
    frames:[
      // Montre portée 2 cases max — les cases au-delà restent grises : limite visible
      {delay:500, label:{text:'Portée limitée à 2 cases — les cases grises sont hors de portée.', type:'move'}, cells:[
        // Ortho 1 case
        {r:2,c:3,cls:'t-move'},{r:4,c:3,cls:'t-move'},
        {r:3,c:2,cls:'t-move'},{r:3,c:4,cls:'t-move'},
        // Diag 1 case
        {r:2,c:2,cls:'t-move'},{r:2,c:4,cls:'t-move'},
        {r:4,c:2,cls:'t-move'},{r:4,c:4,cls:'t-move'},
        // Ortho 2 cases
        {r:1,c:3,cls:'t-kill'}, // cible
        {r:5,c:3,cls:'t-move'},
        {r:3,c:1,cls:'t-move'},{r:3,c:5,cls:'t-move'},
        // Diag 2 cases
        {r:1,c:1,cls:'t-move'},{r:1,c:5,cls:'t-move'},
        {r:5,c:1,cls:'t-move'},{r:5,c:5,cls:'t-move'},
      ], piece:null},
      // Fourmi fonce sur le scarabée en (1,3)
      {delay:2000, label:{text:'Élimine la cible en occupant sa case.', type:'kill'}, cells:[], piece:{r:1,c:3}, killEnemy:true},
      // Montre toutes les cases libres pour replacer la dépouille
      {delay:700, label:{text:'Vous choisissez où replacer la dépouille sur n\'importe quelle case libre.', type:'corpse'}, cells:[
        {r:0,c:0,cls:'t-necro'},{r:0,c:1,cls:'t-necro'},{r:0,c:2,cls:'t-necro'},{r:0,c:3,cls:'t-necro'},{r:0,c:4,cls:'t-necro'},{r:0,c:5,cls:'t-necro'},
        {r:1,c:0,cls:'t-necro'},{r:1,c:1,cls:'t-necro'},{r:1,c:2,cls:'t-necro'},{r:1,c:4,cls:'t-necro'},{r:1,c:5,cls:'t-necro'},
        {r:2,c:0,cls:'t-necro'},{r:2,c:1,cls:'t-necro'},{r:2,c:2,cls:'t-necro'},{r:2,c:3,cls:'t-necro'},{r:2,c:4,cls:'t-necro'},{r:2,c:5,cls:'t-necro'},
        {r:3,c:0,cls:'t-necro'},{r:3,c:1,cls:'t-necro'},{r:3,c:2,cls:'t-necro'},{r:3,c:4,cls:'t-necro'},{r:3,c:5,cls:'t-necro'},
        {r:4,c:0,cls:'t-necro'},{r:4,c:1,cls:'t-necro'},{r:4,c:2,cls:'t-necro'},{r:4,c:3,cls:'t-necro'},{r:4,c:4,cls:'t-necro'},{r:4,c:5,cls:'t-necro'},
        {r:5,c:0,cls:'t-necro'},{r:5,c:1,cls:'t-necro'},{r:5,c:2,cls:'t-necro'},{r:5,c:3,cls:'t-necro'},{r:5,c:4,cls:'t-necro'},{r:5,c:5,cls:'t-necro'},
      ], piece:null},
      // Dépose la dépouille en (5,0)
      {delay:1800, label:{text:'Dépouille repositionnée.', type:'corpse', dur:1800}, cells:[], piece:null, placeCorpse:{r:5,c:0,sym:'scarabee_512.png'}},
      // Reset
      {delay:1800, cells:[], piece:{r:3,c:3}, resetEnemy:true, removeCorpse:true},
    ],
  };
}

/* ================================================================
   ÉTAT
================================================================ */
let _idx=0, _timer=null, _animState={};

window.openTuto = function() {
  document.getElementById('modal-tuto').classList.remove('hidden');
  _idx=0; _buildDots(); _renderSlide(0);
};
window.closeTuto = function() {
  document.getElementById('modal-tuto').classList.add('hidden');
  _stopAnim();
};
window.tutoBackdropClick = function(e) { if(e.target.id==='modal-tuto') closeTuto(); };
window.tutoNav = function(dir) {
  const next=_idx+dir;
  if(next<0||next>=SLIDES.length) return;
  _renderSlide(next);
};

/* ================================================================
   DOTS
================================================================ */
function _buildDots() {
  const c=document.getElementById('tuto-dots'); if(!c) return; c.innerHTML='';
  SLIDES.forEach((_,i)=>{const d=document.createElement('div');d.className='tdot-i';c.appendChild(d);});
}
function _updateDots(idx) {
  document.querySelectorAll('.tdot-i').forEach((d,i)=>{
    d.classList.remove('active','done');
    if(i===idx) d.classList.add('active'); else if(i<idx) d.classList.add('done');
  });
  const lbl=document.getElementById('tuto-step-label');
  if(lbl) lbl.textContent=`${idx+1} / ${SLIDES.length}`;
}

/* ================================================================
   RENDER SLIDE
================================================================ */
function _renderSlide(idx) {
  _stopAnim(); _idx=idx; _updateDots(idx);
  const track=document.getElementById('tuto-track'); if(!track) return;
  track.innerHTML='';
  SLIDES.forEach((slide,i)=>{
    const s=document.createElement('div'); s.className='tuto-slide'; s.id=`ts-${i}`;
    if(i===idx) _buildContent(s,slide,i);
    track.appendChild(s);
  });
  track.style.transform=`translateX(${idx*-100}%)`;
  const prev=document.getElementById('tuto-prev');
  const next=document.getElementById('tuto-next');
  if(prev) prev.disabled=(idx===0);
  if(next){
    const last=(idx===SLIDES.length-1);
    next.textContent=last?'🎮 Jouer !':'Suivant →';
    next.className=last?'tuto-cta last':'tuto-cta';
    next.onclick=last?closeTuto:()=>tutoNav(1);
  }
  const slide=SLIDES[idx];
  if(slide.type==='piece'&&slide.anim) setTimeout(()=>_runAnim(slide,idx),350);
}

/* ================================================================
   BUILD CONTENT
================================================================ */
function _buildContent(el, slide, idx) {
  if(slide.type==='intro') {
    // 4 disques colorés plein sans emoji
    el.innerHTML=`
      <div class="tuto-intro-icon"><img src="reine_guepe_512.png" alt="Reine Guêpe" style="width:3rem;height:3rem;object-fit:contain;"></div>
      <div class="tuto-slide-title">${slide.title}</div>
      <div class="tuto-colony-row">
        <div class="tuto-disc" style="background:radial-gradient(circle at 38% 35%,#FFE060,${COL.yellow});box-shadow:0 0 14px ${COL_GLOW.yellow};"></div>
        <div class="tuto-disc" style="background:radial-gradient(circle at 38% 35%,#60EE90,${COL.green});box-shadow:0 0 14px ${COL_GLOW.green};"></div>
        <div class="tuto-disc" style="background:radial-gradient(circle at 38% 35%,#80B8FF,${COL.blue});box-shadow:0 0 14px ${COL_GLOW.blue};"></div>
        <div class="tuto-disc" style="background:radial-gradient(circle at 38% 35%,#FF8090,${COL.red});box-shadow:0 0 14px ${COL_GLOW.red};"></div>
      </div>
      <div class="tuto-desc">${slide.desc}</div>`;
    return;
  }
  if(slide.type==='stakes') {
    const items=slide.stakes.map(s=>`<li><span class="ico">${s.ico}</span><span>${s.txt}</span></li>`).join('');
    el.innerHTML=`<div class="tuto-slide-title">${slide.title}</div><div class="tuto-desc" style="text-align:left;margin-bottom:4px">${slide.desc}</div><ul class="tuto-stakes-list">${items}</ul>`;
    return;
  }
  const n=slide.boardSize||5;
  el.innerHTML=`
    <div class="tuto-piece-header">
      <div class="tuto-piece-sym"><img src="${slide.sym}" alt="${slide.name}" style="width:100%;height:100%;object-fit:contain;"></div>
      <div class="tuto-piece-title-name">${slide.name}</div>
    </div>
    <div class="tuto-sync-text" id="tst-${idx}"><span></span></div>
    <div class="tuto-board-wrap">
      <div class="tuto-board" id="tb-${idx}" style="grid-template-columns:repeat(${n},1fr);grid-template-rows:repeat(${n},1fr)"></div>
    </div>`;
  const board=el.querySelector(`#tb-${idx}`);
  for(let r=0;r<n;r++) for(let c=0;c<n;c++){
    const cell=document.createElement('div');
    cell.id=`tb-${idx}-${r}-${c}`;
    cell.className=`tb-cell ${(r+c)%2===0?'tl':'td'}`;
    board.appendChild(cell);
  }
}

/* ================================================================
   ANIM ENGINE
================================================================ */
function _stopAnim(){ if(_timer){clearTimeout(_timer);_timer=null;} _animState={}; }

function _runAnim(slide, slideIdx) {
  const anim=slide.anim; if(!anim) return;
  const n=slide.boardSize||5;
  const board=document.getElementById(`tb-${slideIdx}`); if(!board) return;
  board.style.position='relative';
  board.__slideIdx = slideIdx;

  const state={
    piece:{...anim.piece},
    enemy:anim.enemy?{...anim.enemy,alive:true}:null,
    enemies:anim.enemies?anim.enemies.map(e=>({...e,alive:true})):[],
    enemiesDiag:anim.enemiesDiag?anim.enemiesDiag.map(e=>({...e,alive:true})):[],
    corpse:anim.corpse||null,
    corpsePos:anim.corpse?{...anim.corpse}:null,
    flyPhase:'ortho', // for fly
    frames:anim.frames, frameIdx:0, n, slideIdx, _id:Math.random(),
  };
  _animState=state;

  // Place initial pieces
  _placePiece(board, state);
  if(state.enemy) _placeEnemy(board, state.enemy, 'enemy-main');
  state.enemies.forEach((e,i)=>_placeEnemy(board, e, `enemy-${i}`));
  if(state.corpse) _placeCorpse(board, state.corpsePos, n);

  function loop() {
    if(_animState!==state) return;
    if(state.frameIdx>=state.frames.length) {
      // Reset & boucle
      state.frameIdx=0;
      _clearHL(board,n);
      _setSyncText(slideIdx, '', '');
      _clearActionLabels(board);
      state.piece={...anim.piece}; _movePiece(board,state); _clearArrows(board);
      if(state.enemy){state.enemy={...anim.enemy,alive:true};board.querySelectorAll('[data-enemy="enemy-main"]').forEach(e=>e.remove());_placeEnemy(board,state.enemy,'enemy-main');}
      state.enemies=anim.enemies?anim.enemies.map(e=>({...e,alive:true})):[];
      board.querySelectorAll('[data-eidx]').forEach(e=>e.remove());
      state.enemies.forEach((e,i)=>_placeEnemy(board,e,`enemy-${i}`));
      state.enemiesDiag=anim.enemiesDiag?anim.enemiesDiag.map(e=>({...e,alive:true})):[];
      board.querySelectorAll('[data-diag]').forEach(e=>e.remove());
      if(anim.flyPhase) state.flyPhase='ortho';
      if(state.corpse){state.corpsePos={...anim.corpse};board.querySelectorAll('.tbc-corpse').forEach(e=>e.remove());_placeCorpse(board,state.corpsePos,n);}
      _timer=setTimeout(loop,1200); return;
    }
    const frame=state.frames[state.frameIdx]; state.frameIdx++;
    _timer=setTimeout(()=>{
      if(_animState!==state) return;
      _clearHL(board,n);

      if(frame.cells) frame.cells.forEach(({r,c,cls})=>{const cl=document.getElementById(`tb-${slideIdx}-${r}-${c}`);if(cl)cl.classList.add(cls);});
      if(frame.piece){
        const prevR=state.piece.r, prevC=state.piece.c;
        state.piece={...frame.piece};
        _movePiece(board,state,prevR,prevC);
      }

      // Flèche de mouvement explicite (showArrow remplace la flèche auto si besoin)
      if(frame.showArrow){
        const {fr,fc,tr,tc,type}=frame.showArrow;
        _drawArrow(board,fr,fc,tr,tc,type||'move');
      }

      // ── Texte synchronisé dans la zone fixe sous le titre ──
      if(frame.label){
        _setSyncText(slideIdx, frame.label.text, frame.label.type||'move');
      }

      // Repositionnement silencieux de la mouche (flyRepos) — sans transition visible
      if(frame.flyRepos){
        const el=board.querySelector('.tbc-main');
        if(el){ el.style.transition='none'; setTimeout(()=>{ el.style.transition='left .45s cubic-bezier(.4,0,.2,1),top .45s cubic-bezier(.4,0,.2,1)'; },50); }
      }

      // Kill single enemy — déclenché APRÈS la transition CSS (450ms)
      // La cible reste visible pendant tout le trajet de la pièce attaquante
      if(frame.killEnemy&&state.enemy){
        // La flèche verte de _movePiece suffit pour montrer le trajet
        // On ajoute une flèche rouge courte "impact" à l'arrivée
        setTimeout(()=>{
          _drawArrow(board, state.piece.r, state.piece.c, state.enemy.r, state.enemy.c, 'kill');
          state.enemy.alive=false;
          board.querySelectorAll('[data-enemy="enemy-main"]').forEach(el=>{
            el.style.opacity='0';el.style.transform='scale(0)';
            setTimeout(()=>el.remove(),350);
          });
        }, 460); // attend la fin de la transition de déplacement
      }
      // Corpse at position (araignée) — après l'impact + flèche violette vers départ
      if(frame.corpseAt&&state.enemy){
        setTimeout(()=>{
          _placeCorpse(board,{...frame.corpseAt},n);
          // Flèche violette de la case d'impact vers la case de départ (où va la dépouille)
          _drawArrow(board, state.piece.r, state.piece.c, frame.corpseAt.r, frame.corpseAt.c, 'corpse');
        }, 500);
      }
      // Place corpse (reine choisit où)
      if(frame.placeCorpse){
        setTimeout(()=>_placeCorpse(board,{...frame.placeCorpse},n),200);
      }
      // Move corpse (scarabée)
      if(frame.moveCorpse){
        const old=board.querySelector('.tbc-corpse');
        if(old){old.style.opacity='0';setTimeout(()=>{old.remove();_placeCorpse(board,{...frame.moveCorpse,sym:state.corpse&&state.corpse.sym},n);},300);}
        else _placeCorpse(board,{...frame.moveCorpse,sym:state.corpse&&state.corpse.sym},n);
        state.corpsePos={...frame.moveCorpse};
      }
      // Reset corpse
      if(frame.resetCorpse&&state.corpse){
        state.corpsePos={...anim.corpse};
        board.querySelectorAll('.tbc-corpse').forEach(e=>{e.style.opacity='0';setTimeout(()=>e.remove(),300);});
        setTimeout(()=>_placeCorpse(board,state.corpsePos,n),350);
      }
      // Remove corpse
      if(frame.removeCorpse){
        board.querySelectorAll('.tbc-corpse').forEach(e=>{e.style.opacity='0';setTimeout(()=>e.remove(),300);});
      }
      // Teleport enemy (coccinelle)
      if(frame.teleportEnemy&&state.enemy){
        board.querySelectorAll('[data-enemy="enemy-main"]').forEach(e=>{e.style.opacity='0';setTimeout(()=>e.remove(),250);});
        state.enemy={...state.enemy,...frame.teleportEnemy};
        setTimeout(()=>_placeEnemy(board,state.enemy,'enemy-main'),300);
      }
      // Reset enemy
      if(frame.resetEnemy&&state.enemy){
        state.enemy={...anim.enemy,alive:true};
        board.querySelectorAll('[data-enemy="enemy-main"]').forEach(e=>e.remove());
        _placeEnemy(board,state.enemy,'enemy-main');
      }

      // ── FLY PHASES — kills décalés + flèches en éventail ──
      if(frame.killOrtho){
        // Flèches rouges de la mouche vers chaque ennemi ortho
        const orthoTargets=state.enemies.filter(e=>e.alive).map(e=>({r:e.r,c:e.c}));
        if(orthoTargets.length) _drawArrowsFan(board, state.piece.r, state.piece.c, orthoTargets, 'kill');
        setTimeout(()=>{
          state.enemies.forEach((e,i)=>{e.alive=false;board.querySelectorAll(`[data-eidx="${i}"]`).forEach(el=>{el.style.opacity='0';el.style.transform='scale(0)';setTimeout(()=>{el.style.filter='grayscale(1)';el.style.border='2px solid rgba(255,255,255,.25)';el.style.background='transparent';el.style.opacity='0.35';el.style.transform='scale(1)';},350);});});
        }, 300);
      }
      if(frame.killDiag){
        // Flèches rouges de la mouche vers chaque ennemi diag
        const diagTargets=state.enemiesDiag.filter(e=>e.alive).map(e=>({r:e.r,c:e.c}));
        if(diagTargets.length) _drawArrowsFan(board, state.piece.r, state.piece.c, diagTargets, 'kill');
        setTimeout(()=>{
          state.enemiesDiag.forEach((e,i)=>{e.alive=false;board.querySelectorAll(`[data-diag="${i}"]`).forEach(el=>{el.style.opacity='0';el.style.transform='scale(0)';setTimeout(()=>{el.style.filter='grayscale(1)';el.style.border='2px solid rgba(255,255,255,.25)';el.style.background='transparent';el.style.opacity='0.35';el.style.transform='scale(1)';},350);});});
        }, 300);
      }
      if(frame.swapToDiag){
        // Remove ortho enemies, place diag enemies
        board.querySelectorAll('[data-eidx]').forEach(e=>e.remove());
        state.enemies=anim.enemies?anim.enemies.map(e=>({...e,alive:true})):[];
        state.enemiesDiag=anim.enemiesDiag?anim.enemiesDiag.map(e=>({...e,alive:true})):[];
        state.enemiesDiag.forEach((e,i)=>_placeEnemy(board,e,null,i));
        state.flyPhase='diag';
      }
      if(frame.resetFlyPhase){
        board.querySelectorAll('[data-eidx],[data-diag]').forEach(e=>e.remove());
        state.enemies=anim.enemies?anim.enemies.map(e=>({...e,alive:true})):[];
        state.enemies.forEach((e,i)=>_placeEnemy(board,e,`enemy-${i}`));
        state.flyPhase='ortho';
      }
      if(frame.resetAllFly){
        board.querySelectorAll('[data-eidx],[data-diag],[data-enemy]').forEach(e=>e.remove());
        state.enemies=anim.enemies?anim.enemies.map(e=>({...e,alive:true})):[];
        state.enemies.forEach((e,i)=>_placeEnemy(board,e,`enemy-${i}`));
        state.enemiesDiag=anim.enemiesDiag?anim.enemiesDiag.map(e=>({...e,alive:true})):[];
        state.flyPhase='ortho';
      }

      loop();
    }, frame.delay);
  }
  loop();
}

/* ================================================================
   DOM HELPERS — Flèches SVG animées
================================================================ */
function _cs(board){ return board.offsetWidth/(board.__n||5); }
function _px(board,r,c){
  const n=board.__n||5, cs=board.offsetWidth/n, p=0.13;
  return {left:(c*cs+cs*p)+'px', top:(r*cs+cs*p)+'px', size:(cs*(1-p*2))+'px'};
}

// Centre d'une case en coordonnées SVG (px dans le board)
function _cellCenter(board, r, c) {
  const n=board.__n||5, cs=board.offsetWidth/n;
  return { x: c*cs + cs/2, y: r*cs + cs/2 };
}

// Raccourcit une ligne du départ de sr% et de la fin de er% pour éviter de chevaucher les pièces
function _shortenLine(x1,y1,x2,y2,startRatio,endRatio){
  const dx=x2-x1, dy=y2-y1;
  return {
    x1: x1+dx*startRatio, y1: y1+dy*startRatio,
    x2: x2-dx*endRatio,   y2: y2-dy*endRatio
  };
}

// Dessine une flèche SVG animée sur le board
// type: 'move' (vert), 'kill' (rouge), 'corpse' (violet)
function _drawArrow(board, fr, fc, tr, tc, type) {
  _clearArrows(board);
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('tuto-arrow-svg');
  svg.setAttribute('viewBox', `0 0 ${board.offsetWidth} ${board.offsetHeight}`);

  const s = _cellCenter(board, fr, fc);
  const e = _cellCenter(board, tr, tc);
  const n = board.__n||5, cs = board.offsetWidth/n;
  const L = _shortenLine(s.x,s.y,e.x,e.y, 0.32, 0.22);

  // Définition de la tête de flèche
  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg','marker');
  const mid = `ah-${type}-${Date.now()}`;
  marker.setAttribute('id', mid);
  marker.setAttribute('markerWidth','6');
  marker.setAttribute('markerHeight','6');
  marker.setAttribute('refX','3');
  marker.setAttribute('refY','3');
  marker.setAttribute('orient','auto');
  const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
  poly.setAttribute('points','0 0, 6 3, 0 6');
  poly.classList.add(`arrow-head-${type}`);
  marker.appendChild(poly);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Ligne principale
  const line = document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1', L.x1); line.setAttribute('y1', L.y1);
  line.setAttribute('x2', L.x2); line.setAttribute('y2', L.y2);
  line.setAttribute('marker-end', `url(#${mid})`);
  line.classList.add(`arrow-${type}`);
  svg.appendChild(line);
  board.appendChild(svg);

  // Auto-disparaît après 1.2s
  setTimeout(()=>{ if(svg.parentNode) svg.remove(); }, 1200);
}

// Dessine plusieurs flèches depuis une source vers plusieurs cibles (mouche nuée)
function _drawArrowsFan(board, fr, fc, targets, type) {
  _clearArrows(board);
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('tuto-arrow-svg');
  svg.setAttribute('viewBox', `0 0 ${board.offsetWidth} ${board.offsetHeight}`);

  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  const mid = `ah-fan-${Date.now()}`;
  const marker = document.createElementNS('http://www.w3.org/2000/svg','marker');
  marker.setAttribute('id',mid);marker.setAttribute('markerWidth','5');marker.setAttribute('markerHeight','5');
  marker.setAttribute('refX','2.5');marker.setAttribute('refY','2.5');marker.setAttribute('orient','auto');
  const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  poly.setAttribute('points','0 0, 5 2.5, 0 5');
  poly.classList.add(`arrow-head-${type}`);
  marker.appendChild(poly); defs.appendChild(marker); svg.appendChild(defs);

  const s = _cellCenter(board, fr, fc);
  for(const {r,c} of targets){
    const e = _cellCenter(board, r, c);
    const L = _shortenLine(s.x,s.y,e.x,e.y, 0.3, 0.22);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',L.x1);line.setAttribute('y1',L.y1);
    line.setAttribute('x2',L.x2);line.setAttribute('y2',L.y2);
    line.setAttribute('marker-end',`url(#${mid})`);
    line.classList.add(`arrow-${type}`);
    svg.appendChild(line);
  }
  board.appendChild(svg);
  setTimeout(()=>{ if(svg.parentNode) svg.remove(); }, 1400);
}

function _clearArrows(board){
  board.querySelectorAll('.tuto-arrow-svg').forEach(e=>e.remove());
}

function _placePiece(board, state) {
  board.__n=state.n;
  let el=board.querySelector('.tbc-main');
  if(!el){
    el=document.createElement('div'); el.className='tbc-main';
    el.style.cssText='position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:10;pointer-events:none;transition:left .45s cubic-bezier(.4,0,.2,1),top .45s cubic-bezier(.4,0,.2,1);';
    board.appendChild(el);
  }
  const col=state.piece.color||'yellow';
  const c=COL[col]||'#D4A010', g=COL_GLOW[col]||'rgba(240,192,48,.6)';
  const {left,top,size}=_px(board,state.piece.r,state.piece.c);
  const fs=parseFloat(size)*.55;
  el.style.fontSize='0'; // désactivé, on utilise une image
  el.style.left=left; el.style.top=top; el.style.width=size; el.style.height=size;
  el.style.background=`radial-gradient(circle at 38% 35%,${_lighten(c,.4)},${c})`;
  el.style.boxShadow=`0 0 10px ${g}`;
  el.innerHTML=`<img src="${state.piece.sym||'reine_guepe_512.png'}" alt="" style="width:110%;height:110%;object-fit:contain;position:absolute;top:-5%;left:-5%;pointer-events:none;">`; 
}

function _movePiece(board,state,prevR,prevC){
  const el=board.querySelector('.tbc-main'); if(!el) return;
  // Dessine une flèche de déplacement si on connaît la position précédente
  if(prevR!==undefined && prevC!==undefined && (prevR!==state.piece.r || prevC!==state.piece.c)){
    _drawArrow(board, prevR, prevC, state.piece.r, state.piece.c, 'move');
  }
  const {left,top,size}=_px(board,state.piece.r,state.piece.c);
  el.style.left=left; el.style.top=top; el.style.width=size; el.style.height=size;
}

function _placeEnemy(board, enemy, eid, diagIdx) {
  // eid = 'enemy-main' | 'enemy-N' | null (then use diagIdx)
  const col=enemy.color||'red';
  const c=COL[col]||'#E82838', g=COL_GLOW[col]||'rgba(255,48,80,.45)';
  const el=document.createElement('div');
  el.style.cssText='position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:9;pointer-events:none;transition:left .45s cubic-bezier(.4,0,.2,1),top .45s cubic-bezier(.4,0,.2,1),opacity .3s,transform .3s;';
  el.style.background=`radial-gradient(circle at 38% 35%,${_lighten(c,.35)},${c})`;
  el.style.boxShadow=`0 0 8px ${g}`;
  if(eid) el.setAttribute('data-enemy', eid);
  if(diagIdx!==undefined) el.setAttribute('data-diag', diagIdx);
  // Also tag ortho enemies for fly
  if(eid&&eid.startsWith('enemy-')&&!isNaN(eid.split('-')[1])){
    el.setAttribute('data-eidx', eid.split('-')[1]);
  }
  const {left,top,size}=_px(board,enemy.r,enemy.c);
  el.style.left=left; el.style.top=top; el.style.width=size; el.style.height=size;
  el.innerHTML=`<img src="${enemy.sym||'fourmi_512.png'}" alt="" style="width:110%;height:110%;object-fit:contain;position:absolute;top:-5%;left:-5%;pointer-events:none;">`;
  board.appendChild(el);
}

function _placeCorpse(board, pos, n) {
  board.querySelectorAll('.tbc-corpse').forEach(e=>e.remove());
  const el=document.createElement('div'); el.className='tbc-corpse';
  el.style.cssText='position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:8;pointer-events:none;filter:grayscale(1) brightness(.7);opacity:.9;border:3px solid rgba(255,255,255,.95);box-shadow:0 0 10px rgba(255,255,255,.7),0 0 20px rgba(255,255,255,.3);animation:corpseGlow 1.2s ease-in-out infinite;transition:opacity .3s;';
  const {left,top,size}=_px(board,pos.r,pos.c);
  el.style.left=left; el.style.top=top; el.style.width=size; el.style.height=size;
  el.innerHTML=`<img src="${pos.sym||'fourmi_512.png'}" alt="" style="width:110%;height:110%;object-fit:contain;position:absolute;top:-5%;left:-5%;pointer-events:none;">`;
  board.appendChild(el);
}

function _clearHL(board,n){
  board.querySelectorAll('.tb-cell').forEach(c=>c.classList.remove('t-move','t-kill','t-special','t-necro','t-active'));
}

/* Met à jour la zone de texte synchronisée sous le titre */
function _setSyncText(slideIdx, text, type) {
  const zone = document.getElementById(`tst-${slideIdx}`);
  if (!zone) return;
  const sp = zone.querySelector('span');
  if (!sp) return;
  // Fade out
  sp.classList.remove('visible');
  if (!text) return;
  setTimeout(() => {
    sp.className = `type-${type}`;
    sp.textContent = text;
    // Force reflow
    sp.getBoundingClientRect();
    sp.classList.add('visible');
  }, 200);
}

function _clearActionLabels(board) {
  // Kept for compatibility with reset code — no-op now that labels are in sync zone
}
function _lighten(hex, amt) {
  let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  r=Math.min(255,Math.round(r+255*amt)); g=Math.min(255,Math.round(g+255*amt)); b=Math.min(255,Math.round(b+255*amt));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

})();
