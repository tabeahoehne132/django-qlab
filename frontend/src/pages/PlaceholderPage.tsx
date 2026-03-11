import React from 'react'
import './PlaceholderPage.css'

interface PlaceholderPageProps {
  title: string
  subtitle: string
  accentChar: string
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, subtitle, accentChar }) => (
  <div className="tab-panel active placeholder-page">
    <div className="page-title-row">
      <h1 className="page-title">{title}<span>{accentChar}</span></h1>
    </div>
    <div className="page-subtitle">{subtitle}</div>
    <div className="placeholder-body">
      <div className="placeholder-icon">⟳</div>
      <p className="placeholder-label">Coming soon</p>
    </div>
  </div>
)
