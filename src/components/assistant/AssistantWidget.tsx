import kikaImg from '../../assets/kika-avatar.png';

const BUTTON_SIZE = 44;

export default function AssistantWidget() {
  return (
    <button
      type="button"
      disabled
      aria-label="Kika, ο AI βοηθός — σύντομα κοντά σας"
      title="Kika — AI Βοηθός (σύντομα κοντά σας)"
      className="relative flex shrink-0 cursor-not-allowed items-center justify-center overflow-hidden rounded-full opacity-50"
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
        boxShadow: '0 4px 10px rgba(124, 58, 237, 0.35)',
      }}
    >
      <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
    </button>
  );
}
