'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

interface VitalSignsChartProps {
  data: Array<{
    date: string;
    timestamp: string;
    systolic: number | null;
    diastolic: number | null;
    heartRate: number | null;
    temperature: number | null;
    oxygenSaturation: number | null;
  }>;
}

// Custom Tooltip for Vital Signs Chart
const VitalSignsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const dataPoint = payload[0]?.payload;
  const timestamp = dataPoint?.timestamp;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
      {timestamp && (
        <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {format(new Date(timestamp), 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {format(new Date(timestamp), 'h:mm a')}
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          if (entry.value === null || entry.value === undefined) return null;
          
          let label = entry.name;
          let unit = '';
          
          if (entry.dataKey === 'systolic' || entry.dataKey === 'diastolic') {
            unit = ' mmHg';
          } else if (entry.dataKey === 'heartRate') {
            unit = ' bpm';
          } else if (entry.dataKey === 'temperature') {
            unit = '°C';
          } else if (entry.dataKey === 'oxygenSaturation') {
            unit = '%';
          }
          
          return (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
              </div>
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {entry.value}{unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export function VitalSignsChart({ data }: VitalSignsChartProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <div className="h-64 min-h-[256px] w-full">
      <ResponsiveContainer width="100%" height={256}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
          <Tooltip content={<VitalSignsTooltip />} />
          <Legend />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="systolic" 
            stroke="#ef4444" 
            strokeWidth={2}
            name="Systolic BP"
            dot={false}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="diastolic" 
            stroke="#f97316" 
            strokeWidth={2}
            name="Diastolic BP"
            dot={false}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="heartRate" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="Heart Rate"
            dot={false}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="temperature" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            name="Temperature"
            dot={false}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="oxygenSaturation" 
            stroke="#10b981" 
            strokeWidth={2}
            name="O2 Saturation"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

