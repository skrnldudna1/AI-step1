
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
        <div className="size-control-head">
          <label htmlFor="character-size">캐릭터 크기</label>
          <output className="size-control-value" htmlFor="character-size">{size}%</output>
        </div>
  
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
  
        <div className="size-control-foot">
          <span>50%</span>
          <button type="button" onClick={() => onChange(100)}>↺ 기본 크기</button>
          <span>200%</span>
        </div>
      </div>
    );
  }
