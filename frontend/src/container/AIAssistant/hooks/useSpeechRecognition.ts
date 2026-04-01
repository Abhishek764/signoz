import { useCallback, useEffect, useRef, useState } from 'react';

// ── Web Speech API types (not yet in lib.dom.d.ts) ────────────────────────────

interface SpeechRecognitionResult {
	readonly length: number;
	readonly isFinal: boolean;
	[index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionResultList {
	readonly length: number;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
	readonly resultIndex: number;
	readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
	readonly error: string;
	readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	onstart: (() => void) | null;
	onend: (() => void) | null;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

// ── Vendor-prefix shim for Safari / older browsers ────────────────────────────

const SpeechRecognitionAPI: SpeechRecognitionConstructor | null =
	typeof window !== 'undefined'
		? // eslint-disable-next-line @typescript-eslint/no-explicit-any
		  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
		: null;

export type SpeechRecognitionError =
	| 'not-supported'
	| 'not-allowed'
	| 'no-speech'
	| 'network'
	| 'unknown';

interface UseSpeechRecognitionOptions {
	onError?: (error: SpeechRecognitionError) => void;
	/**
	 * Called directly from browser recognition events — no React state intermediary.
	 * `isFinal=false` → interim (live preview), `isFinal=true` → committed text.
	 */
	onTranscript?: (text: string, isFinal: boolean) => void;
	lang?: string;
}

interface UseSpeechRecognitionReturn {
	isListening: boolean;
	isSupported: boolean;
	start: () => void;
	stop: () => void;
	/** Stop recognition and discard any pending interim text (no onTranscript call). */
	discard: () => void;
}

export function useSpeechRecognition({
	onError,
	onTranscript,
	lang = 'en-US',
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
	const [isListening, setIsListening] = useState(false);
	const recognitionRef = useRef<ISpeechRecognition | null>(null);
	const isDiscardingRef = useRef(false);
	const isSupported = SpeechRecognitionAPI !== null;

	// Always-current refs — updated synchronously on every render so closures
	// inside recognition event handlers always call the latest version.
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;

	const stop = useCallback(() => {
		recognitionRef.current?.stop();
	}, []);

	const discard = useCallback(() => {
		isDiscardingRef.current = true;
		recognitionRef.current?.stop();
	}, []);

	const start = useCallback(() => {
		if (!isSupported) {
			onErrorRef.current?.('not-supported');
			return;
		}

		// If already listening, stop
		if (recognitionRef.current) {
			recognitionRef.current.stop();
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const recognition = new SpeechRecognitionAPI!();
		recognition.lang = lang;
		recognition.continuous = true;     // keep listening until user clicks stop
		recognition.interimResults = true; // live updates while speaking

		// Track the last interim text so we can commit it as final in onend —
		// Chrome often skips the isFinal result when stop() is called manually.
		let pendingInterim = '';

		recognition.onstart = (): void => {
			setIsListening(true);
		};

		recognition.onresult = (event): void => {
			let interim = '';
			let finalText = '';

			for (let i = event.resultIndex; i < event.results.length; i++) {
				const text = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					finalText += text;
				} else {
					interim += text;
				}
			}

			if (finalText) {
				pendingInterim = '';
				onTranscriptRef.current?.(finalText, true);
			} else if (interim) {
				pendingInterim = interim;
				onTranscriptRef.current?.(interim, false);
			}
		};

		recognition.onerror = (event): void => {
			pendingInterim = '';
			let mapped: SpeechRecognitionError = 'unknown';
			if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
				mapped = 'not-allowed';
			} else if (event.error === 'no-speech') {
				mapped = 'no-speech';
			} else if (event.error === 'network') {
				mapped = 'network';
			}
			onErrorRef.current?.(mapped);
		};

		recognition.onend = (): void => {
			// Commit any interim text that never received a final result,
			// unless the session was explicitly discarded.
			if (!isDiscardingRef.current && pendingInterim) {
				const committed = pendingInterim;
				pendingInterim = '';
				onTranscriptRef.current?.(committed, true);
			}
			isDiscardingRef.current = false;
			pendingInterim = '';
			setIsListening(false);
			recognitionRef.current = null;
		};

		recognitionRef.current = recognition;
		recognition.start();
	}, [isSupported, lang]);

	// Clean up on unmount
	useEffect(
		() => (): void => {
			recognitionRef.current?.abort();
		},
		[],
	);

	return { isListening, isSupported, start, stop, discard };
}
