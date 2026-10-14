/** Kleinstes gültiges PDF mit leeren Seiten der angegebenen Größe (Punkt); nur für Tests. */
export const testPdf = (seiten: [number, number][]) => {
	const objekte = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		`<< /Type /Pages /Kids [${seiten.map((_, i) => `${i + 3} 0 R`).join(' ')}] /Count ${seiten.length} >>`,
		...seiten.map(([breite, hoehe]) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${breite} ${hoehe}] >>`),
	];
	let pdf = '%PDF-1.4\n';
	const stellen = objekte.map((objekt, i) => {
		const stelle = pdf.length;
		pdf += `${i + 1} 0 obj\n${objekt}\nendobj\n`;
		return stelle;
	});
	const xref = pdf.length;
	pdf += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
	pdf += stellen.map((s) => `${String(s).padStart(10, '0')} 00000 n \n`).join('');
	pdf += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(pdf, 'latin1');
};

export const A4: [number, number] = [595, 842];
export const FOLIE: [number, number] = [960, 540];
