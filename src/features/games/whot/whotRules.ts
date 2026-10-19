import type {
  WhotCard,
  WhotGameState,
  WhotPlayer,
  WhotShape,
} from '@/types/games.types';

// Standard 54-card Naija Whot composition
export const createWhotDeck = (): WhotCard[] => {
  const cards: WhotCard[] = [];
  let cardId = 1;

  const add = (shape: WhotShape, number: number, label?: string) => {
    let cardLabel = label;
    if (!cardLabel) {
      if (number === 1) cardLabel = 'Hold On';
      else if (number === 2) cardLabel = 'Pick Two';
      else if (number === 5) cardLabel = 'Pick Three';
      else if (number === 8) cardLabel = 'Suspension';
      else if (number === 14) cardLabel = 'General Market';
    }
    cards.push({ id: `whot-${cardId++}`, shape, number, label: cardLabel });
  };

  // Circles (12 cards)
  [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14].forEach((n) => add('circle', n));

  // Triangles (12 cards)
  [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14].forEach((n) => add('triangle', n));

  // Crosses (9 cards)
  [1, 2, 3, 5, 7, 10, 11, 13, 14].forEach((n) => add('cross', n));

  // Squares (9 cards)
  [1, 2, 3, 5, 7, 10, 11, 13, 14].forEach((n) => add('square', n));

  // Stars (8 cards)
  [1, 2, 3, 4, 5, 7, 8].forEach((n) => add('star', n));

  // Whot! 20 (5 Wild Cards)
  for (let i = 0; i < 5; i++) {
    add('whot', 20, 'Whot!');
  }

  // Cryptographically / reliably shuffle using Fisher-Yates
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = cards[i];
    cards[i] = cards[j];
    cards[j] = temp;
  }

  return cards;
};

export const createInitialWhotGameState = (
  groupMembers: { id: string; display_name: string; avatar_url?: string | null }[],
  conversationId?: string | null
): WhotGameState => {
  const deck = createWhotDeck();
  const players: WhotPlayer[] = [];

  // Deal 5 cards to each group member
  groupMembers.forEach((member) => {
    const hand = deck.splice(0, 5);
    players.push({
      user_id: member.id,
      display_name: member.display_name,
      avatar_url: member.avatar_url,
      hand,
      isLastCard: false,
    });
  });

  // Find a non-action card for the initial discard pile call card
  let callCardIdx = deck.findIndex(
    (c) => c.number !== 20 && c.number !== 1 && c.number !== 2 && c.number !== 5 && c.number !== 8 && c.number !== 14
  );
  if (callCardIdx === -1) callCardIdx = 0;
  const [initialCallCard] = deck.splice(callCardIdx, 1);

  return {
    drawPile: deck,
    discardPile: [initialCallCard],
    players,
    currentTurnUserId: players[0]?.user_id || 'player-1',
    requestedShape: null,
    pendingPickCount: 0,
    activeActionNotice: `Match started! ${players[0]?.display_name || 'Player 1'} to play.`,
    winnerUserId: null,
    winnerReason: null,
    conversationId: conversationId || null,
  };
};

export const isValidWhotMove = (
  card: WhotCard,
  topCard: WhotCard,
  requestedShape: WhotShape | null,
  pendingPickCount: number
): boolean => {
  // If there's a pending pick penalty (Pick Two / Pick Three), must defend with same action number or draw
  if (pendingPickCount > 0) {
    return card.number === topCard.number;
  }

  // 20 (Whot!) can be played on any card
  if (card.number === 20 || card.shape === 'whot') {
    return true;
  }

  // If a shape was requested by previous Whot 20
  if (requestedShape) {
    return card.shape === requestedShape;
  }

  // Matches shape OR number
  return card.shape === topCard.shape || card.number === topCard.number;
};

export const applyWhotMove = (
  state: WhotGameState,
  userId: string,
  cardId: string,
  chosenShape?: WhotShape
): WhotGameState => {
  const playerIndex = state.players.findIndex((p) => p.user_id === userId);
  if (playerIndex === -1) throw new Error('Player not in this game');
  if (state.currentTurnUserId !== userId) throw new Error('Not your turn');

  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) throw new Error('Card not found in hand');

  const card = player.hand[cardIndex];
  const topCard = state.discardPile[state.discardPile.length - 1];

  if (!isValidWhotMove(card, topCard, state.requestedShape, state.pendingPickCount)) {
    throw new Error('Illegal card move in Naija Whot');
  }

  // Remove card from player hand and place on top of discard pile
  const nextHand = [...player.hand];
  nextHand.splice(cardIndex, 1);

  const nextDiscard = [...state.discardPile, card];
  const nextPlayers = [...state.players];
  nextPlayers[playerIndex] = {
    ...player,
    hand: nextHand,
    isLastCard: nextHand.length === 1,
  };

  // CHECK! (Win condition: hand is empty)
  if (nextHand.length === 0) {
    return {
      ...state,
      discardPile: nextDiscard,
      players: nextPlayers,
      winnerUserId: userId,
      winnerReason: `${player.display_name} shouted CHECK! and cleared all cards to win!`,
      activeActionNotice: `🏆 CHECK! ${player.display_name} won the game!`,
    };
  }

  // Evaluate Special Action Cards
  let nextTurnIdx = (playerIndex + 1) % nextPlayers.length;
  let nextRequestedShape: WhotShape | null = null;
  let nextPendingPicks = state.pendingPickCount;
  let actionNotice: string | null = null;

  if (card.number === 1) {
    // Hold On: Active player plays again
    nextTurnIdx = playerIndex;
    actionNotice = `${player.display_name} played Hold On! Plays again.`;
  } else if (card.number === 2) {
    // Pick Two: Next player must draw 2 (or defend)
    nextPendingPicks += 2;
    actionNotice = `${player.display_name} played Pick Two! (Pending: ${nextPendingPicks})`;
  } else if (card.number === 5) {
    // Pick Three: Next player must draw 3
    nextPendingPicks += 3;
    actionNotice = `${player.display_name} played Pick Three! (Pending: ${nextPendingPicks})`;
  } else if (card.number === 8) {
    // Suspension: Skip next player's turn
    const skippedPlayer = nextPlayers[nextTurnIdx];
    nextTurnIdx = (nextTurnIdx + 1) % nextPlayers.length;
    actionNotice = `Suspension! ${skippedPlayer.display_name}'s turn was skipped.`;
  } else if (card.number === 14) {
    // General Market: Everyone else draws 1 card
    let drawPile = [...state.drawPile];
    nextPlayers.forEach((p, idx) => {
      if (idx !== playerIndex && drawPile.length > 0) {
        const drawn = drawPile.splice(0, 1);
        nextPlayers[idx] = {
          ...p,
          hand: [...p.hand, ...drawn],
          isLastCard: false,
        };
      }
    });
    actionNotice = `General Market! Everyone else went to market.`;
  } else if (card.number === 20 || card.shape === 'whot') {
    // Whot! Wild card: Requested shape
    nextRequestedShape = chosenShape || 'circle';
    actionNotice = `${player.display_name} played Whot 20! Wants: ${nextRequestedShape.toUpperCase()}`;
  }

  const nextTurnUser = nextPlayers[nextTurnIdx].user_id;

  return {
    ...state,
    discardPile: nextDiscard,
    players: nextPlayers,
    currentTurnUserId: nextTurnUser,
    requestedShape: nextRequestedShape,
    pendingPickCount: nextPendingPicks,
    activeActionNotice: actionNotice || `${nextPlayers[nextTurnIdx].display_name}'s turn`,
  };
};

export const applyWhotDraw = (state: WhotGameState, userId: string): WhotGameState => {
  const playerIndex = state.players.findIndex((p) => p.user_id === userId);
  if (playerIndex === -1) throw new Error('Player not in this game');
  if (state.currentTurnUserId !== userId) throw new Error('Not your turn');

  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile];

  // If draw pile runs low, reshuffle discard pile (except top card) into draw pile
  if (drawPile.length < 4 && discardPile.length > 1) {
    const topCard = discardPile.pop()!;
    for (let i = discardPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = discardPile[i];
      discardPile[i] = discardPile[j];
      discardPile[j] = temp;
    }
    drawPile = [...drawPile, ...discardPile];
    discardPile = [topCard];
  }

  const drawCount = state.pendingPickCount > 0 ? state.pendingPickCount : 1;
  const drawnCards = drawPile.splice(0, Math.min(drawCount, drawPile.length));

  const player = state.players[playerIndex];
  const nextPlayers = [...state.players];
  nextPlayers[playerIndex] = {
    ...player,
    hand: [...player.hand, ...drawnCards],
    isLastCard: false,
  };

  const nextTurnIdx = (playerIndex + 1) % nextPlayers.length;
  const nextTurnUser = nextPlayers[nextTurnIdx].user_id;

  return {
    ...state,
    drawPile,
    discardPile,
    players: nextPlayers,
    currentTurnUserId: nextTurnUser,
    pendingPickCount: 0,
    requestedShape: null,
    activeActionNotice: `${player.display_name} drew ${drawCount} card(s) from market. ${nextPlayers[nextTurnIdx].display_name}'s turn.`,
  };
};
