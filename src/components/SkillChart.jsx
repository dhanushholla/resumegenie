import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SkillsChart = ({ data }) => {
    const chartData = {
        labels: data.map(skill => skill.name),
        datasets: [
            {
                label: 'Candidate Overview',
                data: data.map(skill => skill.rating),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'category',
            },
            y: {
                min: 0,
                max: 10,
                title: {
                    display: true,
                    text: 'Rating',
                },
            },
        },
    };

    return <Bar data={chartData} options={options} width={80} height={200}/>;
};

export default SkillsChart;
