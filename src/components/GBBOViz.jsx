import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function GBBOViz() {
	return (
		<div className="gbbo-viz">
			<section>
				<h3>Technical Challenges by Season</h3>
				<p>Each dot is a recipe. Hover to see its name.</p>
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
				.attr('fill', '#888')
				.text(label);
		});

		let sim;

		d3.csv('/files/seasondata.csv').then((data) => {
			const node = svg
				.selectAll('circle.recipe')
				.data(data)
				.enter()
				.append('circle')
				.attr('class', 'recipe')
				.attr('r', 10)
				.attr('fill', (d) => d.color)
				.attr('cursor', 'pointer');

			sim = d3.forceSimulation(data)
				.force('charge', d3.forceCollide().radius(10))
				.force('r', d3.forceRadial((d) => +d.season * 50))
				.on('tick', () => {
					node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
				});

			node
				.on('mouseover', function (event, d) {
					d3.select(this).transition().duration(150).attr('fill', 'orange');
					svg.append('text')
						.attr('id', 'hover-label')
						.attr('dx', 220)
						.attr('dy', 100)
						.attr('font-size', 13)
						.text(d.id);
				})
				.on('mouseout', function (event, d) {
					d3.select(this).transition().duration(150).attr('fill', d.color);
					svg.select('#hover-label').remove();
				});
		});

		return () => {
			if (sim) sim.stop();
		};
	}, []);

	return (
		<svg
			ref={svgRef}
			width={700}
			height={445}
			viewBox="-220 -220 700 445"
			style={{ maxWidth: '100%' }}
		/>
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
				.attr('fill', '#333')
				.text((d) => d.data.id.substring(d.data.id.lastIndexOf('.') + 1));

			// Internal (category) nodes
			node.filter((d) => d.children)
				.append('text')
				.attr('dy', 4)
				.attr('font-size', 12)
				.attr('font-weight', 'bold')
				.attr('fill', '#555')
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
