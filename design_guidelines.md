# Payment Chronicle by Gajanan - Design Guidelines

## Design Approach

**System Selected:** Hybrid approach drawing from **Linear** (clean productivity aesthetic), **Stripe** (professional restraint), and **Financial Times** (editorial authority)

**Rationale:** This is a utility-focused, information-dense platform requiring trust, efficiency, and professional credibility for executive users in the payments industry.

---

## Typography System

**Primary Font:** Inter (via Google Fonts CDN)
- Display/Headlines: 700 weight, 36-48px desktop, 28-36px mobile
- Section Headers: 600 weight, 24-32px desktop, 20-24px mobile
- Body Text: 400 weight, 16px base, 1.6 line-height
- Small Text/Metadata: 400 weight, 14px

**Secondary Font:** Lora (via Google Fonts CDN) - for newsletter content previews only
- Article Headlines: 600 weight, 20-24px
- Summaries: 400 weight, 16px

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Micro spacing: 2-4 units (buttons, form elements)
- Component padding: 6-8 units
- Section spacing: 16-24 units
- Page margins: 20-24 units

**Container Strategy:**
- Full-width sections: w-full with max-w-7xl inner containers
- Content sections: max-w-6xl
- Form containers: max-w-2xl
- Newsletter preview: max-w-4xl

**Grid System:**
- Desktop: 12-column grid with 6-8 unit gaps
- Tablet: 8-column grid with 4-6 unit gaps
- Mobile: 4-column grid with 4 unit gaps

---

## Landing Page Structure

### Hero Section (80vh)
**Layout:** Two-column split (60/40) on desktop, stacked on mobile
- Left: Headline + subheadline + CTA buttons + trust indicator ("Trusted by payments professionals")
- Right: Newsletter preview mockup image or animated preview card

**Image:** Professional mockup showing newsletter PDF on tablet/laptop with payments industry headlines visible

**Components:**
- Primary CTA: "Get Started Free" (large, prominent)
- Secondary CTA: "View Sample Newsletter" (outline style)
- Trust badge: Small badge with user count or industry logos

### How It Works (3-column grid on desktop)
**Cards with:**
- Large numerical indicators (01, 02, 03)
- Feature title
- 2-3 sentence description
- Subtle icon (Font Awesome CDN)

**Three Steps:**
1. Enter company names (max 3)
2. AI generates summaries daily at 9 AM IST
3. Receive PDF newsletter via email

### Sources Section
**Grid layout (2 columns desktop, 1 mobile):**
- Left: Headline "Powered by Premium Sources"
- Right: Logo grid of news sources (PaymentsJournal, Bloomberg, CNBC, Financial Times, etc.)
- Display as subtle logo marks in organized grid (3x3)

### Features Showcase (2-column alternating layout)
**Four Features with Image + Text pairs:**
1. AI-Powered Summarization (image: AI dashboard preview)
2. Finshots-Style Clarity (image: newsletter excerpt)
3. Multi-Company Tracking (image: company selection interface)
4. Automated Delivery (image: email/PDF preview)

**Each Feature:**
- Image: Screenshot or illustration (40% width)
- Content: Headline, 3-4 bullet points, supporting text

### Pricing/CTA Section (centered, single column)
**Components:**
- Bold headline: "Start Your Daily Payments Intelligence"
- Subtext about automation and time savings
- Email signup form (inline with submit button)
- Fine print: "Newsletter delivered daily at 9:00 AM IST"

### Footer (4-column grid desktop, stacked mobile)
- Brand + tagline
- Quick links (About, Privacy, Terms)
- Contact info
- Social proof badge

---

## Application Interface (Dashboard)

### Navigation
**Top horizontal navigation:**
- Logo left-aligned
- Navigation items: Dashboard, Companies, Archive, Settings
- User profile menu right-aligned
- Persistent, fixed position

### Company Management Form
**Card-based layout:**
- User info fields (Name, Email) - horizontal 2-column
- Company input field with helper text: "Enter up to 3 companies (comma or semicolon separated)"
- Example text below input
- Validation feedback inline
- Submit button prominent, right-aligned

### Newsletter Archive/Preview
**List view with cards:**
- Date + company names header
- Collapsible preview of newsletter content
- Download PDF button
- Each newsletter card shows: date, companies covered, article count, download CTA

**Newsletter Content Preview:**
- Article cards in vertical list
- Each shows: headline, summary paragraph (truncated), source link, timestamp
- Maximum 5 articles visible, "View Full PDF" for more

---

## Component Library

### Buttons
- Primary: Solid fill, medium padding (px-6 py-3), rounded corners (rounded-lg)
- Secondary: Border only, same padding
- Tertiary: Text-only with underline on hover
- All buttons: 600 weight text, subtle shadow

### Form Inputs
- Text fields: Border outline, rounded-lg, px-4 py-3
- Labels: Above inputs, 600 weight, mb-2
- Validation states: Border treatment change, inline message below
- Focus state: Prominent border treatment

### Cards
- Subtle border, rounded-xl corners
- Consistent padding (p-6 to p-8)
- Subtle shadow for elevation
- Hover state: Slight shadow increase for interactive cards

### Icons
**Font Awesome (CDN):**
- Navigation: fa-home, fa-building, fa-archive, fa-cog
- Features: fa-robot, fa-envelope, fa-clock, fa-file-pdf
- UI: fa-check, fa-times, fa-info-circle
- Size: 20-24px for feature icons, 16px for inline icons

---

## Images & Visual Assets

### Required Images:

1. **Hero Image:** Newsletter PDF mockup on device (tablet/laptop showing payments industry headlines)
2. **Features Section (4 images):**
   - AI Dashboard interface preview
   - Newsletter excerpt with highlighted summaries
   - Company selection multi-input interface
   - Email inbox with PDF attachment
3. **Source Logos:** Grayscale logo marks for PaymentsJournal, Bloomberg, CNBC, Financial Times, The Economist, American Banker, PaymentsDive
4. **Empty States:** Illustration for "No newsletters yet" dashboard state

### Image Treatment:
- Subtle shadows for depth
- Rounded corners (rounded-xl) for screenshots
- Transparent or subtle background for mockups

---

## Responsive Breakpoints

- Mobile: < 640px (single column, stacked layouts)
- Tablet: 640px - 1024px (2-column max, adjusted spacing)
- Desktop: > 1024px (full multi-column layouts)

**Mobile Priorities:**
- Stack all columns vertically
- Reduce section padding (py-12 instead of py-20)
- Larger tap targets for buttons (min 44px height)
- Simplified navigation (hamburger menu)

---

## Accessibility Standards

- Form labels always visible
- Focus indicators on all interactive elements
- Sufficient contrast ratios (minimum 4.5:1)
- Semantic HTML structure (proper heading hierarchy)
- Alt text for all images
- Keyboard navigation support
- ARIA labels for icon-only buttons

---

## Key Design Principles

1. **Professional Authority:** Design conveys trust and expertise for executive audience
2. **Information Clarity:** Clear hierarchy, scannable content, no visual clutter
3. **Functional Efficiency:** Every element serves a purpose, no decorative excess
4. **Responsive Excellence:** Seamless experience across all devices
5. **Editorial Quality:** Newspaper-inspired layout for newsletter content sections