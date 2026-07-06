import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import descriptions from './gbbo-descriptions.json';

const SELECT_FILTER = 'drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #ffd700)';
const VISITED_FILTER = 'drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #4b2a75)';
const DARK_RED = '#730a05';
const FAV_KEY = 'gbbo-favorites';
const MOBILE_QUERY = '(max-width: 639px)';
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

function HeartButton({ filled, onClick }) {
	return (
		<button
			onClick={onClick}
			aria-label={filled ? 'Remove from saved' : 'Save this dessert'}
			aria-pressed={filled}
			style={{
				position: 'absolute',
				top: -2,
				right: -2,
				padding: 2,
				border: 'none',
				background: 'none',
				cursor: 'pointer',
				pointerEvents: 'auto',
				lineHeight: 0,
			}}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
					fill={filled ? DARK_RED : 'none'}
					stroke={DARK_RED}
					strokeWidth="2"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	);
}

export default function GBBOViz() {
	return (
		<div className="gbbo-viz">
			<section>
				<h3>Technical Challenges by Season</h3>
				<p>Each dot is a recipe. Tap or click one for a short description.</p>
				<BakingCircles />
			</section>
			<section>
				<h3>Recipes by Theme</h3>
				<BakingDendrogram />
			</section>
		</div>
	);
}

function BakingCircles() {
	const svgRef = useRef(null);
	const boxRef = useRef(null);
	const selectedRef = useRef(null);
	const selectByNameRef = useRef(null);
	const [selected, setSelected] = useState(null);
	const [isMobile, setIsMobile] = useState(false);
	const [favorites, setFavorites] = useState([]);

	useEffect(() => {
		const mq = window.matchMedia(MOBILE_QUERY);
		setIsMobile(mq.matches);
		const onChange = (e) => setIsMobile(e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}, []);

	useEffect(() => {
		try {
			const parsed = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]');
			if (Array.isArray(parsed)) {
				setFavorites(parsed.filter((n) => typeof n === 'string' && descriptions[n]));
			}
		} catch {
			// bad stored data — start with no favorites
		}
	}, []);

	const toggleFavorite = (name) => {
		setFavorites((prev) => {
			const next = prev.includes(name)
				? prev.filter((n) => n !== name)
				: [...prev, name];
			try {
				localStorage.setItem(FAV_KEY, JSON.stringify(next));
			} catch {
				// storage unavailable — favorites just won't survive reload
			}
			return next;
		});
	};

	useEffect(() => {
		const svg = d3.select(svgRef.current);
		svg.selectAll('*').remove();

		const rings = [
			{ r: 50,  label: '1', dy: 3 },
			{ r: 100, label: '2', dy: -70 },
			{ r: 150, label: '3', dy: -120 },
			{ r: 200, label: '4', dy: -170 },
		];

		rings.forEach(({ r, label, dy }) => {
			svg.append('circle')
				.attr('r', r)
				.attr('stroke', '#BBB')
				.attr('stroke-opacity', 0.5)
				.attr('fill', 'none');
			svg.append('text')
				.attr('dx', -3)
				.attr('dy', dy)
				.attr('font-size', 13)
				.style('fill', 'var(--gray-400, #888)')
				.text(label);
		});

		let sim, timer;

		// Keep the floating info box pinned near the selected (orbiting) circle
		// by mapping SVG user coordinates to CSS pixels each frame.
		const positionBox = () => {
			const d = selectedRef.current;
			const box = boxRef.current;
			const svgEl = svgRef.current;
			if (!d || !box || !svgEl) return;
			const rect = svgEl.getBoundingClientRect();
			const scale = Math.min(rect.width / 700, rect.height / 445);
			const offX = (rect.width - 700 * scale) / 2;
			const offY = (rect.height - 445 * scale) / 2;
			const px = offX + (d.cxNow + 220) * scale;
			const py = offY + (d.cyNow + 220) * scale;
			let left = px + 16;
			if (left + 200 > rect.width) left = Math.max(0, px - 216);
			box.style.left = `${left}px`;
			box.style.top = `${Math.max(0, py + 16)}px`;
			box.style.visibility = 'visible';
		};

		d3.csv('/files/seasondata.csv').then((data) => {
			const node = svg
				.selectAll('circle.recipe')
				.data(data)
				.enter()
				.append('circle')
				.attr('class', 'recipe')
				.attr('r', 10)
				.attr('fill', (d) => d.color)
				.attr('pointer-events', 'none')
				.style('transition', 'filter 200ms');

			// Invisible enlarged hit areas so the 10px dots are tappable on touch
			// screens; they carry all pointer interaction for the dots.
			const hit = svg
				.selectAll('circle.hit')
				.data(data)
				.enter()
				.append('circle')
				.attr('class', 'hit')
				.attr('r', 24)
				.attr('fill', 'transparent')
				.attr('cursor', 'pointer');

			data.forEach((d) => {
				d.visitedColor = d3.color(d.color).darker(1.6).formatHex();
			});
			const byId = new Map(data.map((d) => [d.id, d]));
			const visited = new Set();

			const restingFill = (d) =>
				visited.has(d) && d !== selectedRef.current ? d.visitedColor : d.color;

			const refreshStyles = () => {
				node
					.style('filter', (n) =>
						n === selectedRef.current
							? SELECT_FILTER
							: visited.has(n)
								? VISITED_FILTER
								: null
					)
					.attr('fill', restingFill);
			};

			const applySelection = (d) => {
				const prev = selectedRef.current;
				if (prev && prev !== d) visited.add(prev);
				selectedRef.current = d;
				refreshStyles();
				setSelected(
					d ? { name: d.id, description: descriptions[d.id] || '' } : null
				);
			};

			selectByNameRef.current = (name) => {
				const d = byId.get(name);
				if (d) applySelection(d);
			};

			hit
				.on('click', (event, d) => {
					event.stopPropagation();
					applySelection(selectedRef.current === d ? null : d);
				})
				.on('mouseover', function (event, d) {
					if (!window.matchMedia(HOVER_QUERY).matches) return;
					node.filter((n) => n === d)
						.transition().duration(150).attr('fill', 'orange');
					svg.append('text')
						.attr('id', 'hover-label')
						.attr('dx', 220)
						.attr('dy', 100)
						.attr('font-size', 13)
						.style('fill', 'var(--gray-200, #333)')
						.text(d.id);
				})
				.on('mouseout', function (event, d) {
					node.filter((n) => n === d)
						.transition().duration(150).attr('fill', restingFill(d));
					svg.select('#hover-label').remove();
				});

			svg.on('click', () => applySelection(null));

			// Settle the dots onto their season rings, then orbit them like a
			// solar system: each ring rotates rigidly (preserving the collision
			// spacing) with inner rings turning faster than outer ones.
			sim = d3.forceSimulation(data)
				.force('charge', d3.forceCollide().radius(10))
				.force('r', d3.forceRadial((d) => +d.season * 50))
				.stop();
			sim.tick(300); // run synchronously to settle before first paint

			const INNER_PERIOD = 24; // seconds per orbit for season 1 (innermost)
			data.forEach((d) => {
				d.orbitR = Math.hypot(d.x, d.y);
				d.angle0 = Math.atan2(d.y, d.x);
				d.omega  = (2 * Math.PI / INNER_PERIOD) / +d.season; // inner = fastest
			});

			timer = d3.timer((elapsed) => {
				const t = elapsed / 1000;
				data.forEach((d) => {
					d.cxNow = d.orbitR * Math.cos(d.angle0 + d.omega * t);
					d.cyNow = d.orbitR * Math.sin(d.angle0 + d.omega * t);
				});
				node.attr('cx', (d) => d.cxNow).attr('cy', (d) => d.cyNow);
				hit.attr('cx', (d) => d.cxNow).attr('cy', (d) => d.cyNow);
				positionBox();
			});
		});

		return () => {
			if (sim) sim.stop();
			if (timer) timer.stop();
		};
	}, []);

	const info = selected && (
		<div style={{ position: 'relative', paddingRight: 24 }}>
			<HeartButton
				filled={favorites.includes(selected.name)}
				onClick={() => toggleFavorite(selected.name)}
			/>
			<strong>{selected.name}</strong>
			<p style={{ margin: '4px 0 0' }}>{selected.description}</p>
		</div>
	);

	const savedList = favorites.length > 0 && (
		<div
			style={{
				minWidth: 160,
				maxWidth: 200,
				marginTop: 12,
				padding: '10px 12px',
				border: '1px solid var(--gray-800, #ddd)',
				borderRadius: 6,
				fontSize: 14,
				lineHeight: 1.4,
			}}
		>
			<strong>Saved</strong>
			<ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
				{favorites.map((name) => (
					<li key={name}>
						<button
							onClick={() => selectByNameRef.current?.(name)}
							style={{
								padding: '2px 0',
								border: 'none',
								background: 'none',
								cursor: 'pointer',
								font: 'inherit',
								fontSize: 13,
								color: 'inherit',
								textDecoration: 'underline',
								textAlign: 'left',
							}}
						>
							{name}
						</button>
					</li>
				))}
			</ul>
		</div>
	);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: isMobile ? 'column' : 'row',
				alignItems: 'flex-start',
				gap: 12,
			}}
		>
			<div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
				<svg
					ref={svgRef}
					width={700}
					height={445}
					viewBox="-220 -220 700 445"
					style={{ maxWidth: '100%' }}
				/>
				{selected && !isMobile && (
					<div
						ref={boxRef}
						style={{
							position: 'absolute',
							left: 0,
							top: 0,
							visibility: 'hidden', // shown once positionBox places it
							maxWidth: 200,
							pointerEvents: 'none',
							background: 'var(--gray-999, #fff)',
							color: 'var(--gray-200, #333)',
							border: '1px solid var(--gray-800, #ddd)',
							borderRadius: 6,
							padding: '8px 10px',
							fontSize: 13,
							lineHeight: 1.4,
							boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
						}}
					>
						{info}
					</div>
				)}
				{selected && isMobile && (
					<div
						style={{
							marginTop: 12,
							padding: '10px 12px',
							border: '1px solid var(--gray-800, #ddd)',
							borderRadius: 6,
							fontSize: 14,
							lineHeight: 1.4,
						}}
					>
						{info}
					</div>
				)}
			</div>
			{savedList}
		</div>
	);
}

function BakingDendrogram() {
	const svgRef = useRef(null);

	useEffect(() => {
		const svg = d3.select(svgRef.current);
		svg.selectAll('*').remove();

		const width = 700;
		const height = 800;
		const g = svg.append('g').attr('transform', 'translate(40,0)');

		const tree = d3.cluster()
			.size([height, width - 460])
			.separation((a, b) => {
				return a.parent === b.parent
					|| a.parent?.parent === b.parent
					|| a.parent === b.parent?.parent ? 0.2 : 0.4;
			});

		const stratify = d3.stratify()
			.parentId((d) => d.id.substring(0, d.id.lastIndexOf('.')));

		d3.csv('/files/themedata.csv').then((data) => {
			const root = stratify(data);
			tree(root);

			g.selectAll('.link')
				.data(root.descendants().slice(1))
				.enter().append('path')
				.attr('fill', 'none')
				.attr('stroke', '#ccc')
				.attr('stroke-width', 1.5)
				.attr('d', (d) =>
					`M${d.y},${d.x}` +
					`C${d.parent.y + 100},${d.x}` +
					` ${d.parent.y + 100},${d.parent.x}` +
					` ${d.parent.y},${d.parent.x}`
				);

			const node = g.selectAll('.node')
				.data(root.descendants())
				.enter().append('g')
				.attr('transform', (d) => `translate(${d.y},${d.x})`);

			// Leaf nodes
			node.filter((d) => !d.children)
				.append('circle')
				.attr('r', 5)
				.attr('fill', (d) => d.data.color || '#ccc');

			node.filter((d) => !d.children)
				.append('a')
				.attr('href', (d) => d.data.recipeurl || null)
				.append('text')
				.attr('dy', 4)
				.attr('x', 9)
				.attr('font-size', 11)
				.style('fill', 'var(--gray-200, #333)')
				.text((d) => d.data.id.substring(d.data.id.lastIndexOf('.') + 1));

			// Internal (category) nodes
			node.filter((d) => d.children)
				.append('text')
				.attr('dy', 4)
				.attr('font-size', 12)
				.attr('font-weight', 'bold')
				.style('fill', 'var(--gray-300, #555)')
				.style('text-anchor', 'middle')
				.text((d) => d.data.id.substring(d.data.id.lastIndexOf('.') + 1));
		});
	}, []);

	return (
		<svg
			ref={svgRef}
			width={700}
			height={800}
			viewBox="-50 50 850 800"
			preserveAspectRatio="xMidYMid meet"
			style={{ maxWidth: '100%' }}
		/>
	);
}
