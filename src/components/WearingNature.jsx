import { useEffect, useState } from 'react';
import { Vibrant } from 'node-vibrant/browser';

const IMAGES = [
	{
		src: '/assets/wearing-nature/fog-sf.jpg',
		label: 'SF Fog',
		alt: 'Rolling fog over San Francisco Bay at night, city lights glowing underneath',
	},
	{
		src: '/assets/wearing-nature/yellow-bluegray.png',
		label: 'Lombard Gardens',
		alt: 'Looking down a garden path on Lombard Street toward the bay, vivid yellow-green hedges',
	},
	{
		src: '/assets/wearing-nature/merced-sf.png',
		label: 'Lake Merced',
		alt: 'Aerial view of a footbridge over Lake Merced surrounded by autumn foliage',
	},
];

const SWATCHES = [
	{ key: 'Vibrant',      label: 'Vibrant' },
	{ key: 'LightVibrant', label: 'Light Vibrant' },
	{ key: 'DarkVibrant',  label: 'Dark Vibrant' },
	{ key: 'Muted',        label: 'Muted' },
	{ key: 'LightMuted',   label: 'Light Muted' },
	{ key: 'DarkMuted',    label: 'Dark Muted' },
];

// Slot definitions: what each selected color will fetch
const OUTFIT_SLOTS = [
	{ label: 'Outfit',     emoji: '👗', query: 'women fashion outfit dress' },
	{ label: 'Shoes',      emoji: '👠', query: 'women shoes fashion' },
	{ label: 'Accessory',  emoji: '👜', query: 'women accessories handbag hat jewelry' },
];

// ─── Color utilities ────────────────────────────────────────────────────────

function rgbToHsl(r, g, b) {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h;
	if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
	else if (max === g) h = ((b - r) / d + 2) / 6;
	else                h = ((r - g) / d + 4) / 6;
	return { h: h * 360, s, l };
}

function hexToHsl(hex) {
	return rgbToHsl(
		parseInt(hex.slice(1, 3), 16),
		parseInt(hex.slice(3, 5), 16),
		parseInt(hex.slice(5, 7), 16),
	);
}

function hexToColorName(hex) {
	const { h, s, l } = hexToHsl(hex);
	if (l < 0.15) return 'black';
	if (l > 0.85) return 'white';
	if (s < 0.12) return 'gray';
	if (h < 15 || h >= 345) return 'red';
	if (h < 40)  return 'orange';
	if (h < 70)  return 'yellow';
	if (h < 155) return 'green';
	if (h < 185) return 'teal';
	if (h < 255) return 'blue';
	if (h < 290) return 'purple';
	return 'pink';
}

// ─── Subject-color matching ──────────────────────────────────────────────────
// Unsplash's color filter keys off an image's *dominant* color, which is usually
// the background (grey shoes on grass read as "green"). To match the focal item
// instead, we sample each candidate's center region, take its dominant color
// *by area* — so a neutral subject reads neutral even on a saturated background —
// and rank candidates by closeness to the selected swatch.

const SCORE_CANDIDATES = 12;   // how many search results to color-check
const CENTER_FRACTION  = 0.5;  // central portion of the image to sample

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload  = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

// Dominant color of the image's center region as {h, s, l}, or null on failure.
async function centerColor(src) {
	try {
		const img = await loadImage(src);
		const W = 64, H = 64;
		const canvas = document.createElement('canvas');
		canvas.width = W; canvas.height = H;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		ctx.drawImage(img, 0, 0, W, H);

		const margin = (1 - CENTER_FRACTION) / 2;
		const { data } = ctx.getImageData(
			Math.floor(W * margin), Math.floor(H * margin),
			Math.ceil(W * CENTER_FRACTION), Math.ceil(H * CENTER_FRACTION),
		);

		// Bucket pixels and keep the most populous bucket (dominant by area).
		const bins = new Map();
		for (let i = 0; i < data.length; i += 4) {
			if (data[i + 3] < 128) continue;  // skip transparent
			const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
			const key = s < 0.15
				? `n${Math.round(l * 4)}`                  // neutral: bucket by lightness
				: `${Math.round(h / 30)}:${Math.round(l * 3)}`;
			const bin = bins.get(key) || { n: 0, h: 0, s: 0, l: 0 };
			bin.n++; bin.h += h; bin.s += s; bin.l += l;
			bins.set(key, bin);
		}
		let best = null;
		for (const bin of bins.values()) if (!best || bin.n > best.n) best = bin;
		return best ? { h: best.h / best.n, s: best.s / best.n, l: best.l / best.n } : null;
	} catch {
		return null;  // image load or tainted-canvas failure
	}
}

// Distance in a chroma plane, so neutral and saturated colors never falsely
// match (a grey subject sits near the origin, far from any vivid hue).
function colorDistance(c1, c2) {
	const a1 = c1.s * Math.cos(c1.h * Math.PI / 180);
	const b1 = c1.s * Math.sin(c1.h * Math.PI / 180);
	const a2 = c2.s * Math.cos(c2.h * Math.PI / 180);
	const b2 = c2.s * Math.sin(c2.h * Math.PI / 180);
	return Math.hypot(a1 - a2, b1 - b2, (c1.l - c2.l) * 0.5);
}

// ─── Unsplash fetch ──────────────────────────────────────────────────────────

async function fetchGarment(hex, slotQuery) {
	const key = import.meta.env.PUBLIC_UNSPLASH_ACCESS_KEY;
	if (!key) return { error: 'no_key' };

	const colorName = hexToColorName(hex);
	// #1: drop the whole-image color filter (it selects background-colored shots)
	// and bias the text query toward clean, focal-subject photography instead.
	const query = `${colorName} ${slotQuery} plain background`;

	try {
		const res  = await fetch(
			`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&content_filter=high&client_id=${key}`
		);
		const data = await res.json();
		if (!data.results?.length) return null;

		// #2: rank candidates by how closely their focal subject matches the swatch.
		const target     = hexToHsl(hex);
		const candidates = data.results.slice(0, SCORE_CANDIDATES);
		const scored     = await Promise.all(candidates.map(async (c) => {
			const cc = await centerColor(c.urls.small);
			return { c, dist: cc ? colorDistance(cc, target) : Infinity };
		}));
		scored.sort((a, b) => a.dist - b.dist);

		// Best subject match, or a random result if color-checking failed (e.g. CORS).
		const pick = scored[0]?.dist < Infinity
			? scored[0].c
			: data.results[Math.floor(Math.random() * data.results.length)];
		return {
			url:        pick.urls.regular,
			thumb:      pick.urls.small,
			pageUrl:    pick.links.html + '?utm_source=wearing_nature&utm_medium=referral',
			photographer:     pick.user.name,
			photographerUrl:  pick.user.links.html + '?utm_source=wearing_nature&utm_medium=referral',
			alt:        pick.alt_description || query,
			colorName,
		};
	} catch {
		return null;
	}
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WearingNature() {
	const [activeIdx,     setActiveIdx]     = useState(0);
	const [palette,       setPalette]       = useState(null);
	const [loading,       setLoading]       = useState(true);
	const [selectedColors, setSelectedColors] = useState([]); // [{key, hex, label}]
	const [outfit,        setOutfit]        = useState(null); // [{slot, color, image}] | null
	const [fetchingOutfit, setFetchingOutfit] = useState(false);
	const [noApiKey,      setNoApiKey]      = useState(false);

	useEffect(() => {
		setLoading(true);
		setPalette(null);
		setSelectedColors([]);
		setOutfit(null);
		Vibrant.from(IMAGES[activeIdx].src)
			.getPalette()
			.then((p) => { setPalette(p); setLoading(false); })
			.catch(() => setLoading(false));
	}, [activeIdx]);

	const handleSwatchClick = (key, hex, label) => {
		setSelectedColors(prev => {
			const idx = prev.findIndex(c => c.key === key);
			if (idx !== -1) return prev.filter(c => c.key !== key);  // deselect
			if (prev.length >= 3) return prev;                        // max 3
			return [...prev, { key, hex, label }];
		});
	};

	const handleStyleMe = async () => {
		setFetchingOutfit(true);
		setOutfit(null);
		setNoApiKey(false);

		const results = await Promise.all(
			selectedColors.map((color, i) =>
				fetchGarment(color.hex, OUTFIT_SLOTS[i].query).then(image => ({
					slot:  OUTFIT_SLOTS[i],
					color,
					image,
				}))
			)
		);

		if (results[0]?.image?.error === 'no_key') {
			setNoApiKey(true);
			setFetchingOutfit(false);
			return;
		}

		setOutfit(results);
		setFetchingOutfit(false);
	};

	const active       = IMAGES[activeIdx];
	const vibrantColor = palette?.Vibrant?.hex;

	return (
		<div style={{ fontFamily: 'inherit' }}>

			{/* Image tabs */}
			<div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
				{IMAGES.map((img, i) => (
					<button
						key={img.src}
						onClick={() => setActiveIdx(i)}
						style={{
							padding: '0.4rem 1rem',
							border: i === activeIdx ? `2px solid ${vibrantColor || '#888'}` : '2px solid transparent',
							borderRadius: '999px',
							background: i === activeIdx ? (vibrantColor || '#888') : 'transparent',
							color: i === activeIdx ? '#fff' : 'inherit',
							cursor: 'pointer',
							fontWeight: i === activeIdx ? 600 : 400,
							transition: 'all 0.2s ease',
							fontSize: '0.9rem',
						}}
					>
						{img.label}
					</button>
				))}
			</div>

			{/* Photo */}
			<img
				src={active.src}
				alt={active.alt}
				style={{
					width: '100%',
					maxHeight: '420px',
					objectFit: 'cover',
					borderRadius: '0.75rem',
					display: 'block',
				}}
			/>

			{/* Palette */}
			<div style={{ marginTop: '1.25rem' }}>
				{loading && (
					<p style={{ color: '#888', fontSize: '0.9rem' }}>Extracting palette…</p>
				)}

				{palette && (
					<>
						{/* Instruction */}
						<p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem', marginTop: 0 }}>
							Pick up to 3 colors to build an outfit ✦
						</p>

						{/* Swatch grid */}
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
								gap: '0.75rem',
								marginBottom: '1.5rem',
							}}
						>
							{SWATCHES.map(({ key, label }) => {
								const swatch = palette[key];
								if (!swatch) return null;
								const hex          = swatch.hex;
								const selIdx       = selectedColors.findIndex(c => c.key === key);
								const isSelected   = selIdx !== -1;
								const slotDef      = isSelected ? OUTFIT_SLOTS[selIdx] : null;

								return (
									<button
										key={key}
										onClick={() => handleSwatchClick(key, hex, label)}
										title={isSelected ? `Deselect (${label})` : `Select for outfit (${label})`}
										style={{
											display: 'flex',
											flexDirection: 'column',
											alignItems: 'flex-start',
											gap: '0.4rem',
											background: 'none',
											border: 'none',
											cursor: 'pointer',
											padding: 0,
											textAlign: 'left',
											position: 'relative',
										}}
									>
										{/* Color square */}
										<div style={{ position: 'relative', width: '100%' }}>
											<div
												style={{
													width: '100%',
													height: '60px',
													borderRadius: '0.5rem',
													background: hex,
													transition: 'transform 0.15s ease, box-shadow 0.15s ease',
													transform: isSelected ? 'scale(0.93)' : 'scale(1)',
													boxShadow: isSelected ? `0 0 0 3px ${hex}88` : 'none',
												}}
											/>
											{/* Badge: slot number + emoji */}
											{isSelected && (
												<div
													style={{
														position: 'absolute',
														top: '-6px',
														right: '-6px',
														width: '22px',
														height: '22px',
														borderRadius: '50%',
														background: '#fff',
														border: `2px solid ${hex}`,
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														fontSize: '0.65rem',
														fontWeight: 700,
														color: '#333',
														lineHeight: 1,
													}}
												>
													{selIdx + 1}
												</div>
											)}
										</div>

										<span style={{ fontSize: '0.75rem', color: '#888', lineHeight: 1.3 }}>
											{label}
										</span>
										<span
											style={{
												fontSize: '0.8rem',
												fontFamily: 'monospace',
												color: isSelected ? hex : 'inherit',
												fontWeight: isSelected ? 700 : 400,
											}}
										>
											{hex}
										</span>
										{/* Slot label */}
										{isSelected && (
											<span style={{ fontSize: '0.7rem', color: '#aaa' }}>
												{slotDef.emoji} {slotDef.label}
											</span>
										)}
									</button>
								);
							})}
						</div>

						{/* Style Me button */}
						{selectedColors.length > 0 && (
							<div style={{ marginBottom: '1.5rem' }}>
								<button
									onClick={handleStyleMe}
									disabled={fetchingOutfit}
									style={{
										padding: '0.6rem 1.5rem',
										background: vibrantColor || '#333',
										color: '#fff',
										border: 'none',
										borderRadius: '999px',
										cursor: fetchingOutfit ? 'default' : 'pointer',
										fontWeight: 600,
										fontSize: '1rem',
										opacity: fetchingOutfit ? 0.7 : 1,
										transition: 'opacity 0.2s ease',
										display: 'inline-flex',
										alignItems: 'center',
										gap: '0.4rem',
									}}
								>
									{fetchingOutfit ? 'Styling…' : `Style me in nature 🌿`}
								</button>

								{/* Selected color chips */}
								<div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
									{selectedColors.map((c, i) => (
										<span
											key={c.key}
											style={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: '0.3rem',
												fontSize: '0.75rem',
												padding: '0.2rem 0.6rem',
												borderRadius: '999px',
												background: c.hex + '22',
												border: `1px solid ${c.hex}66`,
												color: '#555',
											}}
										>
											<span
												style={{
													width: '10px',
													height: '10px',
													borderRadius: '50%',
													background: c.hex,
													display: 'inline-block',
												}}
											/>
											{OUTFIT_SLOTS[i].emoji} {OUTFIT_SLOTS[i].label}
										</span>
									))}
								</div>
							</div>
						)}

						{/* No API key warning */}
						{noApiKey && (
							<div
								style={{
									padding: '1rem',
									borderRadius: '0.5rem',
									background: '#fff8e1',
									border: '1px solid #ffe082',
									fontSize: '0.875rem',
									color: '#555',
									marginBottom: '1.5rem',
								}}
							>
								<strong>Almost there!</strong> Add your free Unsplash key to <code>.env</code>:
								<pre style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', background: '#f5f5f5', padding: '0.5rem', borderRadius: '0.25rem' }}>
									PUBLIC_UNSPLASH_ACCESS_KEY=your_key_here
								</pre>
								<a
									href="https://unsplash.com/developers"
									target="_blank"
									rel="noopener noreferrer"
									style={{ color: '#888', fontSize: '0.8rem' }}
								>
									Get a free key at unsplash.com/developers →
								</a>
							</div>
						)}

						{/* Outfit results */}
						{outfit && (
							<div
								style={{
									borderTop: '1px solid #eee',
									paddingTop: '1.25rem',
								}}
							>
								<h3
									style={{
										fontSize: '1rem',
										fontWeight: 600,
										marginTop: 0,
										marginBottom: '1rem',
										color: vibrantColor || '#333',
									}}
								>
									Nature dressed you 🌿
								</h3>

								<div
									style={{
										display: 'grid',
										gridTemplateColumns: `repeat(${outfit.length}, 1fr)`,
										gap: '1rem',
									}}
								>
									{outfit.map(({ slot, color, image }) => (
										<div key={slot.label}>
											{/* Slot header */}
											<div
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: '0.4rem',
													marginBottom: '0.5rem',
												}}
											>
												<span
													style={{
														width: '12px',
														height: '12px',
														borderRadius: '50%',
														background: color.hex,
														display: 'inline-block',
														flexShrink: 0,
													}}
												/>
												<span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
													{slot.emoji} {slot.label}
												</span>
											</div>

											{/* Image card */}
											{image ? (
												<a
													href={image.pageUrl}
													target="_blank"
													rel="noopener noreferrer"
													style={{ display: 'block', textDecoration: 'none' }}
												>
													<img
														src={image.thumb}
														alt={image.alt}
														style={{
															width: '100%',
															aspectRatio: '3/4',
															objectFit: 'cover',
															borderRadius: '0.5rem',
															display: 'block',
														}}
													/>
													<p
														style={{
															fontSize: '0.7rem',
															color: '#aaa',
															margin: '0.35rem 0 0',
															lineHeight: 1.4,
														}}
													>
														Photo by{' '}
														<a
															href={image.photographerUrl}
															target="_blank"
															rel="noopener noreferrer"
															style={{ color: '#aaa' }}
														>
															{image.photographer}
														</a>{' '}
														on{' '}
														<a
															href="https://unsplash.com?utm_source=wearing_nature&utm_medium=referral"
															target="_blank"
															rel="noopener noreferrer"
															style={{ color: '#aaa' }}
														>
															Unsplash
														</a>
													</p>
												</a>
											) : (
												<div
													style={{
														width: '100%',
														aspectRatio: '3/4',
														borderRadius: '0.5rem',
														background: color.hex + '22',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														fontSize: '2rem',
													}}
												>
													{slot.emoji}
												</div>
											)}
										</div>
									))}
								</div>

								{/* Reshuffle */}
								<button
									onClick={handleStyleMe}
									disabled={fetchingOutfit}
									style={{
										marginTop: '1rem',
										background: 'none',
										border: `1px solid ${vibrantColor || '#888'}`,
										borderRadius: '999px',
										padding: '0.35rem 1rem',
										cursor: fetchingOutfit ? 'default' : 'pointer',
										color: vibrantColor || '#888',
										fontSize: '0.85rem',
										fontWeight: 500,
										opacity: fetchingOutfit ? 0.6 : 1,
									}}
								>
									{fetchingOutfit ? 'Reshuffling…' : 'Reshuffle ✦'}
								</button>
							</div>
						)}

						{/* Colored text row (original feature) */}
						<p
							style={{
								fontSize: '1.1rem',
								lineHeight: 2,
								borderTop: '1px solid #eee',
								paddingTop: '1rem',
								marginTop: '1.5rem',
							}}
						>
							{SWATCHES.map(({ key, label }) => {
								const swatch = palette[key];
								if (!swatch) return null;
								return (
									<span key={key} style={{ color: swatch.hex, marginRight: '1rem' }}>
										{label}
									</span>
								);
							})}
						</p>
					</>
				)}
			</div>
		</div>
	);
}
