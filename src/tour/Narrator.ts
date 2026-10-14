/** Durata stimata della lettura, usata quando la voce non è disponibile: circa 15 caratteri al secondo. */
function estimateDuration(text: string): number {
  return Math.max(2500, text.length * 65);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Voce narrante con la Web Speech API.
 * Il testo viene letto una frase alla volta: Chrome interrompe da solo le letture più lunghe di circa 15 secondi.
 * Se il browser non ha la sintesi vocale, o fallisce, si aspetta il tempo stimato di lettura e la visita prosegue con i soli sottotitoli.
 */
export class Narrator {
  rate = 1;

  private lang: string;
  private readonly synth: SpeechSynthesis | null = 'speechSynthesis' in window ? window.speechSynthesis : null;
  private voice: SpeechSynthesisVoice | null = null;
  /** Aumenta a ogni nuova lettura o interruzione: le letture superate si fermano da sole. */
  private generation = 0;
  /** Letture in corso, tenute in memoria: in Chrome una lettura senza riferimenti può perdere l'evento di fine. */
  private readonly pending = new Set<SpeechSynthesisUtterance>();

  /** `lang` è un codice come «it-IT» o «en-US». */
  constructor(lang: string) {
    this.lang = lang;
    this.pickVoice();
    // In Chrome l'elenco delle voci arriva dopo il caricamento della pagina.
    this.synth?.addEventListener('voiceschanged', () => this.pickVoice());
  }

  /** Cambia la lingua delle prossime letture, e la voce. */
  setLanguage(lang: string): void {
    if (lang === this.lang) return;
    this.lang = lang;
    this.pickVoice();
  }

  /** Legge il testo. Restituisce true se la lettura è arrivata alla fine, false se è stata interrotta. */
  async speak(text: string): Promise<boolean> {
    this.stop();
    const generation = this.generation;
    // Una breve attesa dopo l'interruzione: altrimenti Chrome a volte ignora la nuova lettura.
    await wait(100);
    for (const sentence of splitSentences(text)) {
      if (generation !== this.generation) return false;
      await this.speakSentence(sentence);
    }
    return generation === this.generation;
  }

  stop(): void {
    this.generation++;
    this.pending.clear();
    this.synth?.cancel();
  }

  private speakSentence(sentence: string): Promise<void> {
    const estimate = estimateDuration(sentence) / this.rate;
    if (!this.synth) return wait(estimate);

    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(safety);
        this.pending.delete(utterance);
        resolve();
      };
      // Se il browser non segnala mai la fine, la visita prosegue comunque.
      const safety = setTimeout(finish, estimate * 2 + 3000);

      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = this.lang;
      utterance.rate = this.rate;
      if (this.voice) utterance.voice = this.voice;
      utterance.onend = finish;
      utterance.onerror = (event) => {
        // Interrotta da noi: si chiude subito. Altri errori: si lascia il tempo di leggere il sottotitolo.
        if (event.error === 'interrupted' || event.error === 'canceled') finish();
        else setTimeout(finish, estimate);
      };
      this.pending.add(utterance);
      this.synth?.speak(utterance);
    });
  }

  /**
   * Sceglie una voce nella lingua giusta, preferendo quelle di qualità migliore e, a parità, quelle della stessa
   * variante (per «en-US» una voce americana prima di una inglese).
   */
  private pickVoice(): void {
    const prefix = this.lang.slice(0, 2).toLowerCase();
    const sameVariant = (voice: SpeechSynthesisVoice) => voice.lang.replace('_', '-').toLowerCase() === this.lang.toLowerCase();
    const voices = this.synth?.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith(prefix)) ?? [];
    const good = voices.filter((voice) => /natural|google/i.test(voice.name));
    this.voice = good.find(sameVariant) ?? good[0] ?? voices.find(sameVariant) ?? voices[0] ?? null;
  }
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?;]+[.!?;»"]*\s*/g) ?? [text]).map((sentence) => sentence.trim()).filter(Boolean);
}
