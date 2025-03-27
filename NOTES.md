# Note App Development Notes

## Current State
- Basic note-taking with rich text editor (Quill.js)
- Spaced repetition review system
- Gamification with XP and levels
- Dark mode support
- IndexedDB storage

## Current Issues
1. **Database Origin Issue**
   - Notes stored separately in `localhost:5500` and `127.0.0.1:5500`
   - Need to implement export/import functionality

2. **Performance Concerns**
   - `updateCountdowns` runs every second for all notes
   - Large-scale note loading might be inefficient

## Planned Improvements
1. **Performance Optimizations**
   - Implement pagination for notes
   - Batch DOM updates
   - Use `requestAnimationFrame` for countdown updates

2. **Code Organization**
   - Break down large functions (e.g., `loadNotes`)
   - Implement MVC pattern
   - Add proper error handling

3. **UX Improvements**
   - Add loading states
   - Improve visual feedback
   - Add keyboard shortcuts

4. **Features to Add**
   - Note export/import
   - Better note connections
   - More gamification features

## Implementation Notes

### Review System
```javascript
// Current review intervals
[
    1 * 60 * 1000,    // 1 minute
    3 * 60 * 1000,    // 3 minutes
    90 * 60 * 1000,   // 90 minutes
    8 * 60 * 60 * 1000,  // 8 hours
    23 * 60 * 60 * 1000  // 23 hours
]
```

### XP System
- Note creation: 10 XP
- Review completion:
  - Easy: 20 XP
  - Medium: 10 XP
  - Hard: 5 XP
- Level up: current_level * 100 XP

### Database Schema
```javascript
{
    notes: { keyPath: 'id' },
    reviewSchedule: { keyPath: 'noteId' },
    performance: { keyPath: 'id', autoIncrement: true }
}
```

## Testing
- Basic tests implemented for each module
- Need to add more comprehensive testing
- Consider adding E2E tests

## Dependencies
- TensorFlow.js (for future ML features)
- Quill.js (rich text editor)


# Review2 html
nvm we will take care of that in the future. in our review feed, I want to play a place button on the right side (middle). Pressing that button will lead to a new sidebard to open in the same page. 
