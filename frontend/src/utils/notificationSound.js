let audioContext;

export async function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    if (!audioContext) {
      audioContext = new Ctx();
    }

    // Some browsers block audio until a user gesture; this will throw.
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    const osc1 = audioContext.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);

    const osc2 = audioContext.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(660, now + 0.06);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioContext.destination);

    osc1.start(now);
    osc2.start(now + 0.06);
    osc1.stop(now + 0.12);
    osc2.stop(now + 0.18);
  } catch (_) {
    // ignore (autoplay restrictions, etc.)
  }
}
