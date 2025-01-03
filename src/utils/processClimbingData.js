import Papa from 'papaparse';

// A helper to parse Yosemite decimal ratings into a numeric scale
// so we can compare which route is "hardest."
// This is not perfect (Yosemite ratings can be complex),
// but it’s a decent approximation for sorting.
export function parseYosemiteGrade(gradeString = '') {
  // Examples of possible grade strings:
  // "5.8", "5.10a", "5.10a/b", "5.9+", "5.10d R", "5.11b/c", "5.10-"
  // We'll use a rough scale: 5.9 = 5.9, 5.10a=10.0, 5.10b=10.1, etc.

  // 1. Extract the “5.x” portion
  const match = gradeString.match(/5\.(\d+)([abcd+/-]*)/);
  if (!match) {
    // If we don’t detect a "5.xx", return something very low
    // so it doesn’t overshadow valid climbs.
    return 5.0;
  }

  const numberPart = match[1]; // e.g. "10"
  let letterPart = match[2] || ''; // e.g. "a", "c", "+", etc.

  // Convert numberPart to a base float
  let numeric = parseFloat(numberPart); // e.g. 10

  // For 5.10, 5.11, 5.12, etc., we want to add “sub-grades”
  // a/b/c/d => 0.0, 0.2, 0.4, 0.6 (or any consistent scheme).
  // +/- can also be folded in.

  // Normalize letterPart:
  //   "a" => +0.0
  //   "b" => +0.2
  //   "c" => +0.4
  //   "d" => +0.6
  //   "a/b" => maybe +0.1
  //   plus/minus => add or subtract 0.05
  letterPart = letterPart.toLowerCase();

  // If there's a slash (e.g., "a/b"), average them
  if (letterPart.includes('/')) {
    // "a/b" => average rating between a and b
    const slashParts = letterPart.split('/');
    // We'll do an approximate method: parse each letter, average
    let sum = 0;
    slashParts.forEach((p) => {
      sum += letterToDecimal(p);
    });
    return numeric + sum / slashParts.length;
  }

  // Otherwise, parse the single letter or +/-
  numeric += letterToDecimal(letterPart);

  return numeric;
}

// Helper to convert letter-based subgrades to decimal
function letterToDecimal(letterString) {
  // Ex: "a+", "b-", "c", "d+", "+"
  // We'll parse letter first, then +/- second
  let baseValue = 0.0;

  if (letterString.includes('a')) baseValue = 0.0;
  else if (letterString.includes('b')) baseValue = 0.2;
  else if (letterString.includes('c')) baseValue = 0.4;
  else if (letterString.includes('d')) baseValue = 0.6;
  else if (letterString.includes('+')) {
    // If it's only "+"
    // we'll treat "5.9+" roughly as 5.9 + 0.1 => 6.0 or 5.9
    // It's an ambiguous hack, but we can give it a small bump
    baseValue = 0.1;
  } else if (letterString.includes('-')) {
    // If it's only "-"
    // "5.10-" might be a hair easier than 5.10
    baseValue = -0.1;
  }

  // Now handle an explicit + or - at the end
  if (letterString.endsWith('+')) baseValue += 0.05;
  if (letterString.endsWith('-')) baseValue -= 0.05;

  return baseValue;
}

// Helper for total route length (pitchCount * pitchLength).
// If either is missing, fallback gracefully.
function getTotalRouteLength(row) {
  const pitches = parseInt(row.Pitches) || 1;
  const length = parseInt(row.Length) || 0;
  return length;
}

// Helper to group climbs by date
function groupClimbsByDate(rows) {
  const dateMap = {};
  rows.forEach((row) => {
    if (!row.Date) return;
    const dateStr = row.Date; // e.g. "2024-12-25"
    if (!dateMap[dateStr]) {
      dateMap[dateStr] = [];
    }
    dateMap[dateStr].push(row);
  });
  return dateMap;
}

export const processClimbingData = async (csvUrl) => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvUrl, {
      header: true,
      delimiter: ",",  // Explicitly set the delimiter
      download: true,  // Enable downloading from URL
      skipEmptyLines: true,  // Skip empty lines
      transformHeader: (header) => {
        // Clean up header names if needed
        return header.trim();
      },
      complete: (results) => {
        // Split data into current year and previous year
        const currentYear = 2024;
        const currentYearRows = results.data.filter(row => {
          if (!row.Date || !row.Route) return false;
          return new Date(row.Date).getFullYear() === currentYear;
        });

        const lastYearRows = results.data.filter(row => {
          if (!row.Date || !row.Route) return false;
          return new Date(row.Date).getFullYear() === currentYear - 1;
        });

        // Helper to calculate stats for a given year's rows
        const calculateYearStats = (rows) => ({
          totalClimbs: rows.length,
          uniqueRoutes: new Set(rows.map(row => row.Route)).size,
          climbingSessions: new Set(rows.map(row => row.Date)).size,
          topAreas: getTopAreas(rows, 5), // Get top 5 areas
          sendTypes: {
            onsight: rows.filter(r => r['Lead Style'] === 'Onsight').length,
            flash: rows.filter(r => r['Lead Style'] === 'Flash').length,
            redpoint: rows.filter(r => r['Lead Style'] === 'Redpoint').length,
            topRope: rows.filter(r => r.Style === 'TR').length,
            follow: rows.filter(r => r.Style === 'Follow').length,
          },
          uniqueAreas: new Set(rows.map(row => row.Location?.split(' > ')[1] || '')).size,
          totalPitches: rows.reduce((sum, row) => sum + (parseInt(row.Pitches) || 0), 0),
          totalLength: rows.reduce((sum, row) => sum + (parseInt(row.Length) || 0), 0),
          hardestGrade: rows.reduce((max, row) => {
            const grade = parseYosemiteGrade(row.Rating);
            return grade > max ? grade : max;
          }, 0),
          styles: {
            lead: rows.filter(r => r.Style === 'Lead').length,
            tr: rows.filter(r => r.Style === 'TR' || r.Style === 'Sport').length,
            follow: rows.filter(r => r.Style === 'Follow').length,
          },
          averageGrade: rows.reduce((sum, row) => sum + parseYosemiteGrade(row.Rating), 0) / rows.length
        });

        const thisYearStats = calculateYearStats(currentYearRows);
        const lastYearStats = calculateYearStats(lastYearRows);

        // Calculate year-over-year changes
        const yoyComparison = {
          climbsChange: ((thisYearStats.totalClimbs - lastYearStats.totalClimbs) / lastYearStats.totalClimbs * 100).toFixed(1),
          areasChange: ((thisYearStats.uniqueAreas - lastYearStats.uniqueAreas) / lastYearStats.uniqueAreas * 100).toFixed(1),
          pitchesChange: ((thisYearStats.totalPitches - lastYearStats.totalPitches) / lastYearStats.totalPitches * 100).toFixed(1),
          lengthChange: ((thisYearStats.totalLength - lastYearStats.totalLength) / lastYearStats.totalLength * 100).toFixed(1),
          gradeChange: (thisYearStats.averageGrade - lastYearStats.averageGrade).toFixed(2),
          leadPercentChange: ((thisYearStats.styles.lead / thisYearStats.totalClimbs) - 
                            (lastYearStats.styles.lead / lastYearStats.totalClimbs) * 100).toFixed(1),
        };

        // Filter out any empty lines or partial lines
        const validRows = results.data.filter(row => {
          if (!row.Date || !row.Route) return false;
          const year = new Date(row.Date).getFullYear();
          return year === 2024;
        });

        console.log(results);

        // Basic Stats
        const totalClimbs = validRows.length;
        const uniqueAreas = new Set(
          validRows.map((row) =>
            // e.g. "Texas > Austin Area > Barton Creek Greenbelt"
            // split -> ["Texas","Austin Area","Barton Creek Greenbelt", ...]
            // Maybe we want just the "Austin Area" portion:
            row.Location?.split(' > ')[1] || ''
          )
        ).size;

        const totalPitches = validRows.reduce(
          (sum, row) => sum + (parseInt(row.Pitches) || 0),
          0
        );

        const totalLength = validRows.reduce(
          (sum, row) => sum + (parseInt(row.Length) || 0),
          0
        );

        // Climbing styles
        const styles = {
          lead: validRows.filter((r) => r.Style === 'Lead').length,
          tr: validRows.filter((r) => r.Style === 'TR').length,
          follow: validRows.filter((r) => r.Style === 'Follow').length,
        };

        // Lead styles breakdown
        const leadStyles = {
          onsight: validRows.filter(
            (r) => r['Lead Style'] === 'Onsight'
          ).length,
          flash: validRows.filter(
            (r) => r['Lead Style'] === 'Flash'
          ).length,
          redpoint: validRows.filter(
            (r) => r['Lead Style'] === 'Redpoint'
          ).length,
          fellHung: validRows.filter(
            (r) => r['Lead Style'] === 'Fell/Hung'
          ).length,
        };

        // Grade distribution
        // We'll just group by the "head" of the rating string,
        // e.g. 5.9 (from "5.9+," "5.9 PG13," etc.)
        // Or you can do a more advanced parse. Here we do simple:
        const grades = validRows.reduce((acc, row) => {
          // e.g. "5.10a/b" => "5.10a/b"
          const grade = row.Rating?.split(' ')[0] || 'Unknown';
          acc[grade] = (acc[grade] || 0) + 1;
          return acc;
        }, {});

        // "Longest Route" by total route length
        let longestRoute = null;
        let maxLen = 0;
        validRows.forEach((row) => {
          const routeLen = getTotalRouteLength(row);
          if (routeLen > maxLen) {
            maxLen = routeLen;
            longestRoute = row;
          }
        });

        // "Hardest Route" by rating parse
        let hardestRoute = null;
        let hardestNumeric = 0;
        validRows.forEach((row) => {
          const numericGrade = parseYosemiteGrade(row.Rating);
          if (numericGrade > hardestNumeric) {
            hardestNumeric = numericGrade;
            hardestRoute = row;
          }
        });

        // Day with the most climbs
        const dateGroups = groupClimbsByDate(validRows);
        let busiestDay = { date: null, climbCount: 0 };
        Object.entries(dateGroups).forEach(([dateStr, climbs]) => {
          if (climbs.length > busiestDay.climbCount) {
            busiestDay.date = dateStr;
            busiestDay.climbCount = climbs.length;
          }
        });

        // Longest notes (fun highlight of big beta or story)
        let routeWithLongestNote = null;
        let longestNoteLength = 0;
        validRows.forEach((row) => {
          const noteLen = (row.Notes || '').length;
          if (noteLen > longestNoteLength) {
            longestNoteLength = noteLen;
            routeWithLongestNote = row;
          }
        });

        // Multi-pitch count
        const multiPitchCount = validRows.filter(
          (row) => parseInt(row.Pitches) > 1
        ).length;

        // Earliest and Latest climb
        // (Only works if all dates are valid and in YYYY-MM-DD format.)
        let earliestClimb = null;
        let earliestDate = Infinity; // or a big number
        let latestClimb = null;
        let latestDate = -Infinity; // or a small number

        validRows.forEach((row) => {
          const d = new Date(row.Date).getTime();
          if (d < earliestDate) {
            earliestDate = d;
            earliestClimb = row;
          }
          if (d > latestDate) {
            latestDate = d;
            latestClimb = row;
          }
        });

        // “Favorite” routes by your star rating
        // Might include negative or blank values if user never used “Your Stars”
        // so let’s filter for >= 1
        const favoriteRoutes = validRows
          .filter((row) => parseInt(row['Your Stars']) >= 1)
          .sort((a, b) => parseInt(b['Your Stars']) - parseInt(a['Your Stars']))
          .slice(0, 5)
          .map((row) => ({
            name: row.Route,
            grade: row.Rating,
            stars: row['Your Stars'],
            location: (row.Location || '').split(' > ').slice(-1)[0],
          }));

        // Build the final stats object
        const stats = {
          basicStats: {
            totalClimbs,
            uniqueAreas,
            totalPitches,
            totalLength,
          },
          styles,
          leadStyles,
          gradeDistribution: grades,
          multiPitchCount,

          highlights: {
            longestRoute: longestRoute
              ? {
                  name: longestRoute.Route,
                  date: longestRoute.Date,
                  location: longestRoute.Location,
                  rating: longestRoute.Rating,
                  pitches: longestRoute.Pitches,
                  totalFeet: getTotalRouteLength(longestRoute),
                }
              : null,
            hardestRoute: hardestRoute
              ? {
                  name: hardestRoute.Route,
                  date: hardestRoute.Date,
                  location: hardestRoute.Location,
                  rating: hardestRoute.Rating,
                }
              : null,
            busiestDay,
            routeWithLongestNote: routeWithLongestNote
              ? {
                  name: routeWithLongestNote.Route,
                  date: routeWithLongestNote.Date,
                  location: routeWithLongestNote.Location,
                  rating: routeWithLongestNote.Rating,
                  note: routeWithLongestNote.Notes,
                }
              : null,
            earliestClimb: earliestClimb
              ? {
                  name: earliestClimb.Route,
                  date: earliestClimb.Date,
                  rating: earliestClimb.Rating,
                }
              : null,
            latestClimb: latestClimb
              ? {
                  name: latestClimb.Route,
                  date: latestClimb.Date,
                  rating: latestClimb.Rating,
                }
              : null,
            favoriteRoutes,
          },
        };

        console.log(stats);

        // New stats and insights:

        // 1. Climbing Streaks
        let currentStreak = 0;
        let longestStreak = 0;
        let lastClimbDate = null;
        
        validRows.sort((a, b) => new Date(a.Date) - new Date(b.Date))
          .forEach(row => {
            const currentDate = new Date(row.Date);
            if (!lastClimbDate) {
              currentStreak = 1;
            } else {
              const daysDiff = (currentDate - lastClimbDate) / (1000 * 60 * 60 * 24);
              if (daysDiff <= 1) {
                currentStreak++;
              } else {
                currentStreak = 1;
              }
            }
            longestStreak = Math.max(longestStreak, currentStreak);
            lastClimbDate = currentDate;
          });

        // 2. Time of Day Analysis
        const timeOfDay = {
          morning: 0,   // Before 11am
          midday: 0,    // 11am-3pm
          afternoon: 0, // 3pm-7pm
          evening: 0    // After 7pm
        };

        validRows.forEach(row => {
          const hour = new Date(row.Date).getHours();
          if (hour < 11) timeOfDay.morning++;
          else if (hour < 15) timeOfDay.midday++;
          else if (hour < 19) timeOfDay.afternoon++;
          else timeOfDay.evening++;
        });

        // 3. Average Grade Progress Over Time
        const monthlyGrades = {};
        validRows.forEach(row => {
          const monthKey = row.Date.substring(0, 7); // "2024-01"
          if (!monthlyGrades[monthKey]) {
            monthlyGrades[monthKey] = [];
          }
          monthlyGrades[monthKey].push(parseYosemiteGrade(row.Rating));
        });

        const gradeProgression = Object.entries(monthlyGrades).map(([month, grades]) => ({
          month,
          averageGrade: grades.reduce((a, b) => a + b, 0) / grades.length
        }));

        // Fun new stats
        const sendRatio = {
          onsight: validRows.filter(r => r['Lead Style'] === 'Onsight').length,
          flash: validRows.filter(r => r['Lead Style'] === 'Flash').length,
          redpoint: validRows.filter(r => r['Lead Style'] === 'Redpoint').length,
          attempts: validRows.filter(r => r['Lead Style'] === 'Fell/Hung').length,
        };

        // Calculate "project conversion rate"
        const projectConversionRate = (sendRatio.redpoint / 
          (sendRatio.redpoint + sendRatio.attempts)) * 100;

        // Find the "sending season" (month with most sends)
        const monthlySends = validRows.reduce((acc, row) => {
          const month = new Date(row.Date).getMonth();
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {});
        
        const sendingSeason = Object.entries(monthlySends)
          .reduce((a, b) => a[1] > b[1] ? a : b)[0];

        // Calculate "vertical miles climbed"
        const totalVerticalFeet = validRows.reduce((sum, row) => 
          sum + (parseInt(row.Length) || 0), 0);
        const verticalMiles = (totalVerticalFeet / 5280).toFixed(2);

        // Find the "power day" (day with highest average grade)
        const dateGrades = {};
        validRows.forEach(row => {
          const date = row.Date;
          if (!dateGrades[date]) {
            dateGrades[date] = { total: 0, count: 0 };
          }
          dateGrades[date].total += parseYosemiteGrade(row.Rating);
          dateGrades[date].count++;
        });

        const powerDay = Object.entries(dateGrades)
          .reduce((a, b) => 
            (a[1].total/a[1].count) > (b[1].total/b[1].count) ? a : b);

        // Add new stats to the final stats object
        const enhancedStats = {
          ...stats,
          progression: {
            longestStreak,
            timeOfDay,
            gradeProgression,
          },
          // Additional stats summaries
          averages: {
            climbsPerSession: totalClimbs / Object.keys(dateGroups).length,
            gradeMode: Object.entries(grades)
              .reduce((a, b) => (grades[a] > grades[b] ? a : b))[0],
            pitchesPerClimb: totalPitches / totalClimbs,
          },
          yearComparison: {
            thisYear: thisYearStats,
            lastYear: lastYearStats,
            changes: yoyComparison
          },
          funStats: {
            sendRatio,
            projectConversionRate: projectConversionRate.toFixed(1),
            sendingSeason: new Date(2024, sendingSeason).toLocaleString('default', { month: 'long' }),
            verticalMiles,
            powerDay: {
              date: powerDay[0],
              averageGrade: (powerDay[1].total / powerDay[1].count).toFixed(1),
              climbCount: powerDay[1].count
            },
            // "Rest days are aid" stat
            restDayStreak: calculateLongestRestStreak(validRows),
            // Find their "spirit crag" (most visited location)
            spiritCrag: findMostFrequentLocation(validRows),
            // Calculate their "style score" based on lead/TR ratio
            styleScore: (validRows.filter(r => r.Style === 'Lead').length / validRows.length * 100).toFixed(1),
          }
        };

        resolve(enhancedStats);
      },
      error: (error) => reject(error),
    });
  });
};

// Helper to find longest streak of days without climbing
function calculateLongestRestStreak(rows) {
  const dates = rows.map(r => new Date(r.Date).getTime())
    .sort((a, b) => a - b);
  
  let longestStreak = 0;
  for (let i = 1; i < dates.length; i++) {
    const daysBetween = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
    longestStreak = Math.max(longestStreak, daysBetween);
  }
  return Math.floor(longestStreak);
}

// Helper to find most frequent climbing location
function findMostFrequentLocation(rows) {
  const locations = rows.reduce((acc, row) => {
    const location = row.Location?.split(' > ')[1] || 'Unknown';
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(locations)
    .reduce((a, b) => a[1] > b[1] ? a : b)[0];
}

// Helper to get top climbing areas with visit counts
function getTopAreas(rows, limit = 5) {
  const areaCount = rows.reduce((acc, row) => {
    // Split location and get area (typically the second part)
    const areas = row.Location?.split(' > ') || [];
    const area = areas[1] || 'Unknown'; // Usually the region/area is second part
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(areaCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([area, count]) => ({ area, count }));
}
