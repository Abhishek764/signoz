const convertToNanoSecondsToSecond = (number: number): string =>
	Number.parseFloat((number / 1000000).toString()).toFixed(2);

export default convertToNanoSecondsToSecond;
