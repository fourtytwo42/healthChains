/**
 * Date Parsing Utilities for Patient Search
 * 
 * Supports multiple date formats for searching by birthdate:
 * - mm/dd/yyyy, dd/mm/yyyy, yyyy/mm/dd, etc.
 * - Month names (January, Jan, etc.)
 * - Year-only searches
 */

/**
 * Month name mappings (full and abbreviated)
 */
const MONTH_NAMES: Record<string, number> = {
  'january': 1, 'jan': 1,
  'february': 2, 'feb': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9, 'sept': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12,
};

/**
 * Parse a date string in various formats
 * Returns a Date object or null if parsing fails
 */
function parseDateString(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try formats with slashes: mm/dd/yyyy, dd/mm/yyyy, yyyy/mm/dd
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, part1, part2, year] = slashMatch;
    const p1 = parseInt(part1);
    const p2 = parseInt(part2);
    const y = parseInt(year);
    
    // Try mm/dd/yyyy first (US format)
    if (p1 <= 12 && p2 <= 31) {
      const date = new Date(y, p1 - 1, p2);
      if (!isNaN(date.getTime())) return date;
    }
    // Try dd/mm/yyyy (European format)
    if (p2 <= 12 && p1 <= 31) {
      const date = new Date(y, p2 - 1, p1);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Try formats with dashes: mm-dd-yyyy, dd-mm-yyyy, yyyy-mm-dd
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, part1, part2, year] = dashMatch;
    const p1 = parseInt(part1);
    const p2 = parseInt(part2);
    const y = parseInt(year);
    
    // Try mm-dd-yyyy first
    if (p1 <= 12 && p2 <= 31) {
      const date = new Date(y, p1 - 1, p2);
      if (!isNaN(date.getTime())) return date;
    }
    // Try dd-mm-yyyy
    if (p2 <= 12 && p1 <= 31) {
      const date = new Date(y, p2 - 1, p1);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Try formats with dots: mm.dd.yyyy, dd.mm.yyyy
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const [, part1, part2, year] = dotMatch;
    const p1 = parseInt(part1);
    const p2 = parseInt(part2);
    const y = parseInt(year);
    
    if (p1 <= 12 && p2 <= 31) {
      const date = new Date(y, p1 - 1, p2);
      if (!isNaN(date.getTime())) return date;
    }
    if (p2 <= 12 && p1 <= 31) {
      const date = new Date(y, p2 - 1, p1);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Try year-only (4 digits)
  const yearMatch = trimmed.match(/^\d{4}$/);
  if (yearMatch) {
    const year = parseInt(trimmed);
    if (year >= 1900 && year <= 2100) {
      // Return a date representing the year (January 1st)
      return new Date(year, 0, 1);
    }
  }
  
  return null;
}

/**
 * Parse month name or number
 * Returns month number (1-12) or null
 */
function parseMonth(monthStr: string): number | null {
  const lower = monthStr.toLowerCase().trim();
  
  // Check month name mappings
  if (MONTH_NAMES[lower]) {
    return MONTH_NAMES[lower];
  }
  
  // Try numeric month
  const num = parseInt(lower);
  if (num >= 1 && num <= 12) {
    return num;
  }
  
  return null;
}

/**
 * Check if a search query matches a date string (ISO format: YYYY-MM-DD)
 * Supports multiple date formats and month names
 */
export function matchesDate(searchQuery: string, dateString: string): boolean {
  if (!searchQuery || !dateString) return false;
  
  const query = searchQuery.trim().toLowerCase();
  const dateStr = dateString.trim();
  
  // Direct string match (for year-only or partial matches)
  if (dateStr.toLowerCase().includes(query)) {
    return true;
  }
  
  // Try to parse the search query as a date
  const parsedDate = parseDateString(query);
  if (parsedDate) {
    // Parse the patient's date string
    const patientDate = parseDateString(dateStr);
    if (!patientDate) return false;
    
    // Check if years match (for year-only searches)
    if (query.match(/^\d{4}$/)) {
      return patientDate.getFullYear() === parsedDate.getFullYear();
    }
    
    // Check if full dates match
    return (
      patientDate.getFullYear() === parsedDate.getFullYear() &&
      patientDate.getMonth() === parsedDate.getMonth() &&
      patientDate.getDate() === parsedDate.getDate()
    );
  }
  
  // Try to match month names
  const month = parseMonth(query);
  if (month) {
    const patientDate = parseDateString(dateStr);
    if (patientDate) {
      return patientDate.getMonth() + 1 === month;
    }
  }
  
  // Try formats like "January 15" or "Jan 15, 1990" or "15 January"
  const monthDayMatch = query.match(/^(\w+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/);
  if (monthDayMatch) {
    const [, monthPart, dayPart, yearPart] = monthDayMatch;
    const parsedMonth = parseMonth(monthPart);
    if (parsedMonth) {
      const day = parseInt(dayPart);
      const year = yearPart ? parseInt(yearPart) : null;
      const patientDate = parseDateString(dateStr);
      if (patientDate) {
        if (year) {
          return (
            patientDate.getFullYear() === year &&
            patientDate.getMonth() + 1 === parsedMonth &&
            patientDate.getDate() === day
          );
        } else {
          return (
            patientDate.getMonth() + 1 === parsedMonth &&
            patientDate.getDate() === day
          );
        }
      }
    }
  }
  
  // Try formats like "15 January" or "15 Jan 1990"
  const dayMonthMatch = query.match(/^(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?$/);
  if (dayMonthMatch) {
    const [, dayPart, monthPart, yearPart] = dayMonthMatch;
    const parsedMonth = parseMonth(monthPart);
    if (parsedMonth) {
      const day = parseInt(dayPart);
      const year = yearPart ? parseInt(yearPart) : null;
      const patientDate = parseDateString(dateStr);
      if (patientDate) {
        if (year) {
          return (
            patientDate.getFullYear() === year &&
            patientDate.getMonth() + 1 === parsedMonth &&
            patientDate.getDate() === day
          );
        } else {
          return (
            patientDate.getMonth() + 1 === parsedMonth &&
            patientDate.getDate() === day
          );
        }
      }
    }
  }
  
  return false;
}

/**
 * Format a date string (ISO format) to a readable format
 */
export function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  
  const date = parseDateString(dateString);
  if (!date) return dateString;
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${month}/${day}/${year}`;
}

