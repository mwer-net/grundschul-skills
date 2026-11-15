/**
 * Spalten nach Platz: Unter dem Inhaltscontainer fallen Format, Klasse und Fach nacheinander weg. Ohne Material in
 * Sicht gibt es die drei gar nicht, der Platz geht an den Namen (188-35).
 */
export const listenRaster = (mitMaterial: boolean, mitOrt = false) => {
	// Der Ort braucht Platz für den letzten Ordner ganz (189-13); der Name gibt ihn ab.
	if (mitOrt) {
		return mitMaterial
			? 'grid grid-cols-[minmax(0,1fr)_6.5rem_14rem] @3xl:grid-cols-[minmax(0,1fr)_6.5rem_14rem_7rem] @4xl:grid-cols-[minmax(0,1fr)_6.5rem_14rem_7rem_5rem_5rem_9rem]'
			: 'grid grid-cols-[minmax(0,1fr)_6.5rem_14rem] @4xl:grid-cols-[minmax(0,1fr)_6.5rem_14rem_9rem]';
	}
	return mitMaterial
		? 'grid grid-cols-[minmax(0,1fr)_6.5rem_8rem] @3xl:grid-cols-[minmax(0,1fr)_6.5rem_8rem_7rem] @4xl:grid-cols-[minmax(0,1fr)_6.5rem_8rem_7rem_5rem_5rem_9rem]'
		: 'grid grid-cols-[minmax(0,1fr)_6.5rem_8rem] @4xl:grid-cols-[minmax(0,1fr)_6.5rem_8rem_9rem]';
};
