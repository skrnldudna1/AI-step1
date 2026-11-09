import type {
  CharacterReaction,
  CharacterType,
} from '../../types/character';

import BasicCharacter from './BasicCharacter';
import ImageCharacter from './ImageCharacter';

interface CharacterProps {
  characterType?: CharacterType;
  reaction: CharacterReaction;
  isThinking: boolean;
  isTalking: boolean;
  reactionId: number;
}

function Character({
  characterType = 'basic',
  reaction,
  isThinking,
  isTalking,
  reactionId,
}: CharacterProps) {
  const characterProps = {
    reaction,
    isThinking,
    isTalking,
    reactionId,
  };

  switch (characterType) {
    case 'illustration':
      return <ImageCharacter {...characterProps} />;

    case 'basic':
    default:
      return <BasicCharacter {...characterProps} />;
  }
}

export default Character;