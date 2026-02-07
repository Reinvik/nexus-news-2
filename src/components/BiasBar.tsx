"use client";

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// 5-point bias distribution type (must match analyzer.ts but defined here for component isolation or imported if possible)
// To keep it simple we'll assume the props match the shape
interface BiasBarProps {
    distribution: {
        'left': number;
        'center-left': number;
        'center': number;
        'center-right': number;
        'right': number;
    };
    className?: string;
}

export const BiasBar: React.FC<BiasBarProps> = ({ distribution, className }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;

        // Extract values, default to 0 if undefined (safety)
        const left = distribution['left'] || 0;
        const centerLeft = distribution['center-left'] || 0;
        const center = distribution['center'] || 0;
        const centerRight = distribution['center-right'] || 0;
        const right = distribution['right'] || 0;

        const total = left + centerLeft + center + centerRight + right;
        const totalCount = total === 0 ? 1 : total;

        const data = [
            { label: 'Left', value: left, color: '#ef4444' },        // Red 500
            { label: 'C-Left', value: centerLeft, color: '#f87171' }, // Red 400
            { label: 'Center', value: center, color: '#a855f7' },     // Purple 500
            { label: 'C-Right', value: centerRight, color: '#60a5fa' },// Blue 400
            { label: 'Right', value: right, color: '#3b82f6' }        // Blue 500
        ];

        const width = 300;
        const height = 20;
        const radius = 999; // Fully rounded

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const xScale = d3.scaleLinear()
            .domain([0, totalCount])
            .range([0, width]);

        let currentX = 0;

        data.forEach((d, i) => {
            const segmentWidth = xScale(d.value);

            if (segmentWidth > 0) {
                // Ensure min width for visibility if value > 0 but very small? No, keep proportional.

                svg.append('rect')
                    .attr('x', currentX)
                    .attr('y', 0)
                    .attr('width', segmentWidth)
                    .attr('height', height)
                    .attr('fill', d.color)
                    // Add slight gap between segments could look cool, but let's keep continuous
                    .attr('title', `${d.label}: ${d.value}`);

                currentX += segmentWidth;
            }
        });

    }, [distribution]);

    return (
        <div className={`flex flex-col gap-2 ${className}`}>

            {/* Scale Legends */}
            <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider w-full px-1">
                <div className="flex gap-2">
                    {distribution.left > 0 && <span className="text-red-400">Left ({distribution.left})</span>}
                    {distribution['center-left'] > 0 && <span className="text-red-300">C-Left ({distribution['center-left']})</span>}
                </div>

                {distribution.center > 0 && <span className="text-purple-400">Center ({distribution.center})</span>}

                <div className="flex gap-2 justify-end">
                    {distribution['center-right'] > 0 && <span className="text-blue-300">C-Right ({distribution['center-right']})</span>}
                    {distribution.right > 0 && <span className="text-blue-400">Right ({distribution.right})</span>}
                </div>
            </div>

            <svg
                ref={svgRef}
                viewBox="0 0 300 20"
                className="w-full h-3 rounded-full bg-slate-800 overflow-hidden"
                preserveAspectRatio="none"
            />
        </div>
    );
};
