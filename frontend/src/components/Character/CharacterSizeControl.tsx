
interface CharacterSizeControlProps {
    size: number;
    onChange: (size: number) => void;
  }
  
  export default function CharacterSizeControl({
    size,
    onChange,
  }: CharacterSizeControlProps) {
    return (
      <div className="character-size-control">
        <label htmlFor="character-size">
          캐릭터 크기: {size}%
        </label>
  
        <input
          id="character-size"
          type="range"
          min="50"
          max="200"
          step="5"
          value={size}
          onChange={(event) =>
            onChange(Number(event.target.value))
          }
        />
  
        <button
          type="button"
          onClick={() => onChange(100)}
        >
          기본 크기
        </button>
      </div>
    );
  }
  