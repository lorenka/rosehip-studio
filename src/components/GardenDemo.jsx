import { useMemo, useState } from 'react';
import plants from './wgh-plants.json';

const cardStyle = {
	border: '1px solid var(--gray-800, #ddd)',
	borderRadius: 8,
	padding: '1rem',
	background: 'var(--gray-999, #fff)',
};

export default function GardenDemo() {
	const [query, setQuery] = useState('');
	const [garden, setGarden] = useState([]);

	const results = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return plants
			.filter(
				(p) =>
					p.common.toLowerCase().includes(q) ||
					p.latin.toLowerCase().includes(q)
			)
			.slice(0, 8);
	}, [query]);

	const inGarden = (p) => garden.some((g) => g.latin === p.latin);

	const add = (p) => {
		if (!inGarden(p)) setGarden((prev) => [...prev, p]);
	};

	const remove = (latin) =>
		setGarden((prev) => prev.filter((g) => g.latin !== latin));

	return (
		<div
			className="garden-demo"
			style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
				gap: '1rem',
				alignItems: 'start',
			}}
		>
			<div style={cardStyle}>
				<strong>Find a vegetable</strong>
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Try “tomato”, “kale”, “squash”…"
					aria-label="Search vegetables by common or Latin name"
					style={{
						display: 'block',
						width: '100%',
						margin: '0.75rem 0',
						padding: '0.5rem 0.75rem',
						fontSize: '1rem',
						border: '1px solid var(--gray-700, #bbb)',
						borderRadius: 6,
						background: 'var(--gray-999, #fff)',
						color: 'var(--gray-100, #222)',
					}}
				/>
				{query.trim() === '' ? (
					<p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-300, #666)' }}>
						Search {plants.length} vegetables from the app’s seed catalog by
						common or Latin name, then plant the ones you like.
					</p>
				) : results.length === 0 ? (
					<p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-300, #666)' }}>
						Nothing matching “{query.trim()}” — this demo only knows vegetables.
					</p>
				) : (
					<ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
						{results.map((p) => {
							const planted = inGarden(p);
							return (
								<li
									key={p.latin}
									style={{
										display: 'flex',
										alignItems: 'baseline',
										justifyContent: 'space-between',
										gap: '0.75rem',
										padding: '0.4rem 0',
										borderTop: '1px solid var(--gray-800, #eee)',
									}}
								>
									<span style={{ minWidth: 0 }}>
										{p.common}{' '}
										<em style={{ fontSize: '0.85rem', color: 'var(--gray-300, #666)' }}>
											{p.latin}
										</em>
									</span>
									<button
										onClick={() => add(p)}
										disabled={planted}
										style={{
											flexShrink: 0,
											padding: '0.2rem 0.7rem',
											fontSize: '0.85rem',
											border: '1px solid var(--gray-700, #bbb)',
											borderRadius: 999,
											background: 'none',
											color: 'inherit',
											cursor: planted ? 'default' : 'pointer',
											opacity: planted ? 0.5 : 1,
										}}
									>
										{planted ? 'Planted' : 'Plant'}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			<div style={cardStyle}>
				<strong>
					My demo garden{garden.length > 0 && ` · ${garden.length}`}
				</strong>
				{garden.length === 0 ? (
					<p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', color: 'var(--gray-300, #666)' }}>
						Nothing planted yet. In the real app this garden would live in
						Supabase and be shareable with a QR code.
					</p>
				) : (
					<ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
						{garden.map((p) => (
							<li
								key={p.latin}
								style={{
									display: 'flex',
									alignItems: 'baseline',
									justifyContent: 'space-between',
									gap: '0.75rem',
									padding: '0.4rem 0',
									borderTop: '1px solid var(--gray-800, #eee)',
								}}
							>
								<span style={{ minWidth: 0 }}>
									🌱 {p.common}{' '}
									<em style={{ fontSize: '0.85rem', color: 'var(--gray-300, #666)' }}>
										{p.latin}
									</em>
								</span>
								<button
									onClick={() => remove(p.latin)}
									aria-label={`Remove ${p.common}`}
									style={{
										flexShrink: 0,
										padding: '0.1rem 0.5rem',
										fontSize: '0.9rem',
										border: 'none',
										borderRadius: 4,
										background: 'none',
										color: 'var(--gray-300, #666)',
										cursor: 'pointer',
									}}
								>
									×
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
