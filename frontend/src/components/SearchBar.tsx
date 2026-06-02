"use client";

import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  timeFilter: string;
  onTimeFilterChange: (v: string) => void;
}

export default function SearchBar({
  value,
  onChange,
  timeFilter,
  onTimeFilterChange,
}: SearchBarProps) {
  return (
    <div className="flex items-center space-x-3">
      <div className="flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tìm theo nội dung hoặc tên..."
          className="w-full rounded-lg border border-white/70 bg-white/60 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400"
        />
      </div>

      <div>
        <select
          value={timeFilter}
          onChange={(e) => onTimeFilterChange(e.target.value)}
          className="rounded-lg border border-white/70 bg-white/60 px-3 py-2 text-sm shadow-sm"
          aria-label="Lọc theo thời gian"
        >
          <option value="all">Tất cả</option>
          <option value="today">Hôm nay</option>
          <option value="7">7 ngày</option>
          <option value="30">30 ngày</option>
        </select>
      </div>
    </div>
  );
}
