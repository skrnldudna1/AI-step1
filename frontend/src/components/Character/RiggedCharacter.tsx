import type { CharacterRig } from '../../types/rig';
import type { CharacterReaction } from '../../types/character';

import './RiggedCharacter.css';

interface RiggedCharacterProps {
  rig: CharacterRig;
  reaction: CharacterReaction;
}

export default function RiggedCharacter({
  rig,
  reaction,
}: RiggedCharacterProps) {

  const expression = rig.expressions[reaction.emotion];

  return (
    <div
      className="rigged-character"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: rig.canvas.width,
        aspectRatio: `${rig.canvas.width} / ${rig.canvas.height}`,
        isolation: 'isolate',
        userSelect: 'none',
      }}
    >
      {rig.parts.map((part) => (
        <img
          key={part.id}
          src={expression?.[part.id] ?? part.src}
          alt=""
          draggable={false}

          className={`rig-part rig-part-${part.type}`}

          data-part={part.id}
          data-type={part.type}

          style={{
            position: 'absolute',

            left: `${part.x / rig.canvas.width * 100}%`,
            top: `${part.y / rig.canvas.height * 100}%`,

            width: `${part.width / rig.canvas.width * 100}%`,
            height: `${part.height / rig.canvas.height * 100}%`,

            transformOrigin:
              `${part.pivotX * 100}% ${part.pivotY * 100}%`,

            zIndex: part.zIndex,
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}