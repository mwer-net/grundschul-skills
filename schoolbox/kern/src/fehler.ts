export class SchoolboxFehler extends Error {
	constructor(
		message: string,
		readonly exitCode = 2,
	) {
		super(message);
		this.name = 'SchoolboxFehler';
	}
}
