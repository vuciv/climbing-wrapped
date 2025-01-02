import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import styled from '@emotion/styled';
import { processClimbingData, parseYosemiteGrade } from '../utils/processClimbingData';
import ticksData from '../data/ticks.csv';

// ----- STYLED COMPONENTS -----
const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #363636 100%);
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen;
`;

const Section = styled(motion.section)`
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 3rem;
  margin-bottom: 2rem;
  background: linear-gradient(45deg, #FF8E53, #FE6B8B);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const Stat = styled.div`
  font-size: 1.8rem;
  margin: 1rem 0;
`;

// Example “tagline” text styling
const Tagline = styled(motion.div)`
  font-size: 1.4rem;
  margin-top: 1rem;
  max-width: 600px;
  line-height: 1.4;
  color: #aaa;
`;

// Add new styled component for stats animation
const AnimatedStat = styled(motion.div)`
  font-size: 1.8rem;
  margin: 1rem 0;
`;

// Add this styled component with your other styled components
const ComparisonStat = styled(AnimatedStat)`
  display: flex;
  align-items: center;
  gap: 1rem;
  
  .change {
    font-size: 1rem;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    background: ${props => props.isPositive ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)'};
    color: ${props => props.isPositive ? '#4caf50' : '#f44336'};
  }
`;

// Add new styled components
const FullscreenSection = styled(Section)`
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  height: auto;
  padding: 4rem 2rem;
  background: ${props => props.gradient || 'linear-gradient(135deg, #1a1a1a 0%, #363636 100%)'};
`;

const BigStat = styled(motion.div)`
  font-size: 8rem;
  font-weight: bold;
  background: linear-gradient(45deg, #FF8E53, #FE6B8B);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 2rem 0;
`;

const Emphasis = styled(motion.span)`
  color: #FE6B8B;
  font-weight: bold;
`;

const FloatingEmoji = styled(motion.div)`
  position: absolute;
  font-size: 2rem;
  opacity: 0.6;
`;

function ClimbingWrapped() {
  // In a real app, you might parse a CSV file, call processClimbingData,
  // then store that in local state:
  const [stats, setStats] = useState(null);
  //
  useEffect(() => {
    // Pass the imported CSV data directly
    processClimbingData(ticksData)
      .then((res) => setStats(res))
      .catch((error) => console.error('Error loading climbing data:', error));
  }, []);
  

  if (!stats) {
    return <div>Loading...</div>;
  }

  // Prep grade data for Recharts
  const gradeData = Object.entries(stats.gradeDistribution)
    .map(([grade, count]) => ({
      grade,
      count,
      // Convert grade to numeric value for sorting
      numericGrade: parseYosemiteGrade(grade)
    }))
    // Sort by numeric grade in descending order (hardest first)
    .sort((a, b) => a.numericGrade - b.numericGrade)
    // Remove the numeric grade as it's no longer needed for display
    .map(({ grade, count }) => ({
      grade,
      count
    }));

  // Add animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.3
      }
    }
  };

  const statVariants = {
    hidden: { 
      opacity: 0,
      y: 20
    },
    visible: { 
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  // Add floating emoji animation
  const floatingEmojis = ['🧗‍♀️', '🪨', '🏔️', '💪', '🎯'];
  
  return (
    <Container>
      {/* Dramatic Opening Section */}
      <FullscreenSection
        gradient="linear-gradient(135deg, #000 0%, #1a1a1a 100%)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      >
        {/* Add floating emojis */}
        {floatingEmojis.map((emoji, i) => (
          <FloatingEmoji
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0 
            }}
            animate={{ 
              y: [0, -20, 0],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.8
            }}
          >
            {emoji}
          </FloatingEmoji>
        ))}
        
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 1 }}
        >
          <Title>Your 2024 Climbing Story</Title>
          <Tagline>Let's relive your sends...</Tagline>
        </motion.div>
      </FullscreenSection>

      {/* Dramatic Total Climbs Reveal */}
      <FullscreenSection
        gradient="linear-gradient(135deg, #1a1a1a 0%, #2d1f3d 100%)"
      >
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <Tagline>This year, you crushed...</Tagline>
          <BigStat
            initial={{ scale: 0.5, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            {stats.basicStats.totalClimbs}
          </BigStat>
          <Tagline>total climbs!</Tagline>
        </motion.div>
      </FullscreenSection>

      {/* Personal Achievement Section */}
      <FullscreenSection
        gradient="linear-gradient(135deg, #2d1f3d 0%, #1a1a1a 100%)"
      >
        <Title>Your Biggest Send</Title>
        <motion.div
          initial={{ x: -300, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <Stat>
            <Emphasis>{stats.highlights.hardestRoute.name}</Emphasis>
            <br />
            {stats.highlights.hardestRoute.rating}
          </Stat>
          <Tagline>
            That's harder than {Math.round(stats.basicStats.totalClimbs * 0.9)} of your other climbs!
          </Tagline>
        </motion.div>
      </FullscreenSection>

      <FullscreenSection
        gradient="linear-gradient(135deg, #2d1f3d 0%, #1a1a1a 100%)"
      >

      {/* Grade Distribution Section - Enhanced Animation */}
        <Title
          initial={{ x: -50, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          Grade Breakdown
        </Title>
        <motion.div 
          style={{ width: '80%', maxWidth: '600px', height: '300px' }}
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <ResponsiveContainer>
            <BarChart data={gradeData}>
              <XAxis dataKey="grade" stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Tooltip
                contentStyle={{ backgroundColor: '#444', border: 'none' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="count" fill="#FE6B8B" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </FullscreenSection>

      {/* Your Climbing Journey Section */}
      <FullscreenSection
        gradient="linear-gradient(135deg, #2d1f3d 0%, #1a1a1a 100%)"
      >
        <Title>Your Epic Journey</Title>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <BigStat
            initial={{ scale: 0.5, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            {stats.progression.longestStreak}
          </BigStat>
          <Tagline>Your longest sending streak! 🔥</Tagline>
          
          {/* Time of Day Preference */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <Stat>
              You're a{' '}
              <Emphasis>
                {Object.entries(stats.progression.timeOfDay)
                  .reduce((a, b) => a[1] > b[1] ? a : b)[0]}{' '}
              </Emphasis>
              crusher
            </Stat>
            <small>That's when you climb your best!</small>
          </motion.div>
        </motion.div>
      </FullscreenSection>

      {/* Grade Progression Section */}
      <FullscreenSection
        gradient="linear-gradient(135deg, #1a1a1a 0%, #2d1f3d 100%)"
      >
        <Title>Your Grade Journey</Title>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Stat>
            Most Frequent Grade:{' '}
            <Emphasis>{stats.averages.gradeMode}</Emphasis>
          </Stat>
          <Tagline>
            You averaged {stats.averages.climbsPerSession.toFixed(1)} climbs per session
            {stats.averages.climbsPerSession > 5 ? ' - Talk about endurance! 💪' : ''}
          </Tagline>
        </motion.div>
      </FullscreenSection>

      {/* Epic Achievements Section */}
      <FullscreenSection
        gradient="linear-gradient(135deg, #2d1f3d 0%, #1a1a1a 100%)"
      >
        <Title>Epic Achievements</Title>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
        >
          {/* Longest Route */}
          <AnimatedStat variants={statVariants}>
            <Emphasis>Longest Conquest</Emphasis>
            <br />
            {stats.highlights.longestRoute.name}
            <br />
            <small>
              {stats.highlights.longestRoute.pitches} pitches,
              approximately {stats.highlights.longestRoute.totalFeet} feet of climbing!
            </small>
          </AnimatedStat>

          {/* Busiest Day */}
          <AnimatedStat variants={statVariants}>
            <Emphasis>Your Most Savage Day</Emphasis>
            <br />
            {new Date(stats.highlights.busiestDay.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric'
            })}
            <br />
            <small>
              You crushed {stats.highlights.busiestDay.climbCount} routes in one day! 🔥
            </small>
          </AnimatedStat>
        </motion.div>
      </FullscreenSection>

      {/* Year Over Year Growth - Dramatic Reveal */}
      <FullscreenSection
        gradient="linear-gradient(135deg, #1a1a1a 0%, #2d1f3d 100%)"
      >
        <Title>Your Evolution</Title>
        
        {/* Total Climbs Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <ComparisonStat 
            isPositive={stats.yearComparison.changes.climbsChange > 0}
          >
            Total Sends
            <div className="change">
              {stats.yearComparison.changes.climbsChange > 0 ? '+' : ''}
              {stats.yearComparison.changes.climbsChange}%
            </div>
          </ComparisonStat>

          {/* Grade Progression */}
          <ComparisonStat 
            isPositive={stats.yearComparison.changes.gradeChange > 0}
          >
            Grade Progression
            <div className="change">
              {stats.yearComparison.changes.gradeChange > 0 ? '+' : ''}
              {stats.yearComparison.changes.gradeChange} grade points
            </div>
          </ComparisonStat>

          {/* Motivational Message */}
          <Tagline
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            {stats.yearComparison.changes.climbsChange > 0 
              ? "You're on fire! This was your strongest year yet! 🚀" 
              : "Every climber's journey has its peaks and valleys. Keep pushing! 💪"}
          </Tagline>
        </motion.div>
      </FullscreenSection>
      {/* Fun Stats Section */}
      <FullscreenSection
        gradient="linear-gradient(135deg, #1a1a1a 0%, #2d1f3d 100%)"
      >
        <Title>The Fun Stuff</Title>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
        >
          <AnimatedStat variants={statVariants}>
            <Emphasis>{stats.funStats.verticalMiles}</Emphasis> vertical miles climbed
            <br />
            <small>That's {(stats.funStats.verticalMiles / 5.5).toFixed(1)}x the height of Mount Everest! 🏔️</small>
          </AnimatedStat>

          <AnimatedStat variants={statVariants}>
            Your sending season was <Emphasis>{stats.funStats.sendingSeason}</Emphasis>
            <br />
            <small>Must've been perfect sending temps! 🌡️</small>
          </AnimatedStat>
        </motion.div>
      </FullscreenSection>
    </Container>
  );
}

// Helper function to generate personality description
function generatePersonalityDescription(stats) {
  const style = stats.styles.lead > stats.styles.tr ? 'lead' : 'top rope';
  const intensity = stats.averages.climbsPerSession > 5 ? 'high-volume crusher' : 'precision climber';
  const timing = Object.entries(stats.progression.timeOfDay)
    .reduce((a, b) => a[1] > b[1] ? a : b)[0];

  return `You're a ${timing} ${style} specialist and ${intensity}. 
          ${stats.yearComparison.changes.gradeChange > 0 
            ? "Your dedication to progression is paying off!" 
            : "You're building a solid foundation!"}`;
}

export default ClimbingWrapped;
