import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';

import RiggedCharacter from '../Character/RiggedCharacter';

import type {
  CharacterRig,
  RigGenerateResponse,
} from '../../types/rig';

import './CharacterUploader.css';

const API_URL = 'http://127.0.0.1:8000';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface CharacterFeature {
  id: string;
  type: string;
  bounds: Bounds;
  center: Point;
  area: number;
}

interface Geometry {
  canvas: {
    width: number;
    height: number;
  };
  bounds: Bounds;
  center: Point;
  has_transparent_background: boolean;
  contour_count: number;
  features: CharacterFeature[];
}

interface AnalysisResult {
  status: string;
  filename: string;
  width: number;
  height: number;
  format: string;
  mode: string;
  has_alpha: boolean;
  geometry: Geometry;
  message: string;
}

export default function CharacterUploader() {

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<string | null>(null);

  const [error, setError] = useState('');

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [analysis, setAnalysis] =
    useState<AnalysisResult | null>(null);

  const [showOverlay, setShowOverlay] =
    useState(true);

  const [generatedRig, setGeneratedRig] =
    useState<CharacterRig | null>(null);

  const isBusy = isAnalyzing || isGenerating;

  // ========================================
  // 이미지 선택
  // ========================================

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {

    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        'PNG, JPG, WEBP 이미지만 사용할 수 있습니다.'
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        '이미지는 10MB 이하로 선택해 주세요.'
      );
      return;
    }

    setError('');
    setAnalysis(null);
    setGeneratedRig(null);
    setShowOverlay(true);
    setSelectedFile(file);
  };

  // ========================================
  // 이미지 미리보기
  // ========================================

  useEffect(() => {

    if (!selectedFile) {
      setPreview(null);
      return;
    }

    const imageUrl =
      URL.createObjectURL(selectedFile);

    setPreview(imageUrl);

    return () => {
      URL.revokeObjectURL(imageUrl);
    };

  }, [selectedFile]);

  // ========================================
  // 이미지 분석
  // ========================================

  const handleAnalyze = async () => {

    if (!selectedFile || isBusy) return;

    setIsAnalyzing(true);
    setError('');
    setAnalysis(null);
    setGeneratedRig(null);

    try {

      const formData = new FormData();

      formData.append('file', selectedFile);

      const response = await fetch(
        `${API_URL}/api/character/analyze`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {

        const data = await response.json()
          .catch(() => null);

        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : '이미지 분석에 실패했습니다.'
        );
      }

      const data: AnalysisResult =
        await response.json();

      setAnalysis(data);
      setShowOverlay(true);

    } catch (error) {

      setError(
        error instanceof Error
          ? error.message
          : '서버 연결에 실패했습니다.'
      );

    } finally {

      setIsAnalyzing(false);
    }
  };

  // ========================================
  // 캐릭터 자동 리깅 생성
  // ========================================

  const handleGenerate = async () => {

    if (!selectedFile || isBusy) return;

    setIsGenerating(true);
    setError('');
    setGeneratedRig(null);

    try {

      const formData = new FormData();

      formData.append('file', selectedFile);

      const response = await fetch(
        `${API_URL}/api/character/generate`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {

        const data = await response.json()
          .catch(() => null);

        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : '캐릭터 생성에 실패했습니다.'
        );
      }

      const data: RigGenerateResponse =
        await response.json();

      // 이미지 파일명을 실제 서버 주소로 변환
      const baseUrl = new URL(
        data.base_url,
        API_URL
      );

      const rig: CharacterRig = {
        ...data.rig,

        parts: data.rig.parts.map((part) => ({
          ...part,

          src: new URL(
            part.src,
            baseUrl
          ).href,
        })),
      };

      setGeneratedRig(rig);

    } catch (error) {

      setError(
        error instanceof Error
          ? error.message
          : '캐릭터 생성에 실패했습니다.'
      );

    } finally {

      setIsGenerating(false);
    }
  };

  // ========================================
  // 초기화
  // ========================================

  const handleReset = () => {

    setSelectedFile(null);
    setAnalysis(null);
    setGeneratedRig(null);
    setError('');
    setShowOverlay(true);
  };

  return (

    <section className="character-uploader">

      <h2>나만의 캐릭터 만들기</h2>

      <p className="uploader-description">
        움직이고 싶은 캐릭터 이미지를 선택해 주세요.
      </p>

      <label className="upload-area">

        {preview ? (

          <img
            src={preview}
            className="upload-preview"
            alt="캐릭터 미리보기"
          />

        ) : (

          <div className="upload-placeholder">
            <span>＋</span>
            <p>캐릭터 이미지 선택</p>
            <small>PNG, JPG, WEBP</small>
          </div>

        )}

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          disabled={isBusy}
        />

      </label>

      {selectedFile && (
        <p className="upload-filename">
          {selectedFile.name}
        </p>
      )}

      {error && (
        <p className="upload-error" role="alert">
          {error}
        </p>
      )}

      {selectedFile && (

        <div className="upload-actions">

          <button
            type="button"
            className="upload-analyze"
            onClick={handleAnalyze}
            disabled={isBusy}
          >
            {isAnalyzing
              ? '이미지 분석 중...'
              : '캐릭터 분석하기'}
          </button>

          <button
            type="button"
            className="upload-reset"
            onClick={handleReset}
            disabled={isBusy}
          >
            이미지 제거
          </button>

        </div>

      )}

      {/* 이미지 분석 결과 */}

      {analysis && preview && (

        <div className="analysis-result">

          <h3>이미지 분석 완료!</h3>

          <div className="analysis-visual">

            <svg
              viewBox={`0 0 ${analysis.width} ${analysis.height}`}
              className="analysis-svg"
            >

              <image
                href={preview}
                x={0}
                y={0}
                width={analysis.width}
                height={analysis.height}
              />

              {showOverlay && (

                <g>

                  <rect
                    {...analysis.geometry.bounds}
                    fill="none"
                    stroke="#ef5350"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                  />

                  <circle
                    cx={analysis.geometry.center.x}
                    cy={analysis.geometry.center.y}
                    r={2}
                    fill="#4285f4"
                  />

                  {analysis.geometry.features.map(
                    (feature, index) => (

                      <g key={feature.id}>

                        <rect
                          {...feature.bounds}
                          fill="none"
                          stroke={
                            feature.type === 'unknown'
                              ? '#999999'
                              : '#22c55e'
                          }
                          strokeWidth={1}
                        />

                        <text
                          x={feature.bounds.x}
                          y={feature.bounds.y - 2}
                          fontSize={5}
                          fill="#16803c"
                          fontWeight="bold"
                        >
                          {index + 1}
                        </text>

                      </g>
                    )
                  )}

                </g>

              )}

            </svg>

          </div>

          <label className="overlay-toggle">

            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(event) =>
                setShowOverlay(event.target.checked)
              }
            />

            분석 영역 표시

          </label>

          <div className="analysis-legend">

            <span className="legend-bounds">
              전체 영역
            </span>

            <span className="legend-feature">
              얼굴 파츠
            </span>

            <span className="legend-center">
              중심점
            </span>

          </div>

          <p>파일: {analysis.filename}</p>

          <p>
            해상도: {analysis.width} × {analysis.height}
          </p>

          <p>이미지 형식: {analysis.format}</p>

          <p>색상 모드: {analysis.mode}</p>

          <p>
            투명 픽셀:
            {analysis.geometry.has_transparent_background
              ? ' 있음'
              : ' 없음'}
          </p>

          <p>
            얼굴 파츠: {
              analysis.geometry.features.filter(
                (feature) => feature.type !== 'unknown'
              ).length
            }개
          </p>

          <button
            type="button"
            className="generate-button"
            onClick={handleGenerate}
            disabled={isBusy}
          >
            {isGenerating
              ? '캐릭터 생성 중...'
              : '캐릭터 생성하기'}
          </button>

        </div>

      )}

      {/* 자동 조립된 캐릭터 */}

      {generatedRig && (

        <div className="rig-preview">

          <h3>캐릭터 생성 완료!</h3>

          <div className="rig-preview-stage">

            <RiggedCharacter
              rig={generatedRig}
              reaction={{
                emotion: 'neutral',
                action: 'idle',
                intensity: 0,
              }}
            />

          </div>

          <p>
            전체 레이어: {generatedRig.parts.length}개
          </p>

          <p>
            얼굴 파츠: {
              generatedRig.parts.filter(
                (part) => part.id !== 'base'
              ).length
            }개
          </p>

          <p className="rig-success-message">
            캐릭터 자동 조립에 성공했습니다.
          </p>

        </div>

      )}

    </section>

  );
}