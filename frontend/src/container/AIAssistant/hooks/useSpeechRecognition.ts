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
	lang?: string;
}

interface UseSpeechRecognitionReturn {
	isListening: boolean;
	isSupported: boolean;
	/** Current transcript text (interim or final). Empty string between sessions. */
	transcript: string;
	/** True when the current transcript is a final (committed) result. */
	isFinal: boolean;
	start: () => void;
	stop: () => void;
}

export function useSpeechRecognition({
	onError,
	lang = 'en-US',
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
	const [isListening, setIsListening] = useState(false);
	const [transcript, setTranscript] = useState('');
	const [isFinal, setIsFinal] = useState(false);
	const recognitionRef = useRef<ISpeechRecognition | null>(null);
	const isSupported = SpeechRecognitionAPI !== null;

	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	const stop = useCallback(() => {
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
		recognition.continuous = false;    // auto-stops after a pause
		recognition.interimResults = true; // live updates while speaking

		// Track the last interim text so we can commit it as final in onend —
		// Chrome often skips the isFinal result when stop() is called manually.
		let pendingInterim = '';

		recognition.onstart = (): void => {
			setIsListening(true);
			setTranscript('');
			setIsFinal(false);
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
				setTranscript(finalText);
				setIsFinal(true);
			} else if (interim) {
				pendingInterim = interim;
				setTranscript(interim);
				setIsFinal(false);
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
			// Commit any interim text that never received a final result
			// (happens when stop() is called manually before the browser finalizes).
			if (pendingInterim) {
				setTranscript(pendingInterim);
				setIsFinal(true);
				pendingInterim = '';
			}
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

	return { isListening, isSupported, start, stop, transcript, isFinal };
}
