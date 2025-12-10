# CLDT Example Files

This directory contains example `.cldt` files to demonstrate various features of the CLDT Editor extension.

## Files Overview

### Basic Examples

- **simple-test.cldt** - Basic Cloudinary URL example
- **simple-url.cldt** - Simple transformation URL
- **url.cldt** - Standard URL format
- **commented-url.cldt** - URL with comments

### Formatting Examples

- **formatted-with-spacing.cldt** - Example with proper spacing
- **url-formatted.cldt** - Formatted URL structure
- **url-with-indentation.cldt** - Indented URL format
- **complex-url.cldt** - Complex transformation
- **complex-url-formatted.cldt** - Complex transformation with formatting

### Feature Testing

- **variable-syntax-test.cldt** - Tests variable syntax highlighting
- **test-highlighting.cldt** - Tests syntax highlighting
- **test-hover-anchors.cldt** - Tests hover provider functionality
- **if-else-test.cldt** - Tests conditional logic (if/else)
- **multiline-text-test.cldt** - Tests multiline text handling

### Hints Feature Testing

#### 🎯 Float Dimension Test

**File:** `float-dimension-test.cldt`
**Purpose:** Demonstrates float dimension detection in the hints system
**Content:**

```
https://res.cloudinary.com/demo/image/upload/w_500.5,h_300.75,c_fill/sample.jpg
```

**Expected Hints:**

- ⚠️ Line 2: Width parameter 'w_500.5' contains a decimal point. Use an integer value instead (e.g., w_501).
- ⚠️ Line 2: Height parameter 'h_300.75' contains a decimal point. Use an integer value instead (e.g., h_301).

#### 🎯 Invalid Variable Assignment Test

**File:** `invalid-variable-test.cldt`
**Purpose:** Demonstrates invalid variable assignment detection from Cloudinary errors
**Content:**

```
$titlerand_!hellllo,
```

**Expected Hints:**

- ❌ Line 3: Invalid assignment to variable '$titlerand' with value '!hellllo'. Check the variable syntax and value format.

#### 🎯 Scale Without Dimensions Test

**File:** `scale-no-dimensions-test.cldt`
**Purpose:** Demonstrates info hint for scale without dimensions
**Content:**

```
https://res.cloudinary.com/demo/image/upload/c_scale,q_auto/sample.jpg
```

**Expected Hints:**

- ℹ️ Using c*scale without width or height parameter. Consider adding w* or h\_ to specify dimensions.

#### 🎯 Correct Dimensions Test

**File:** `correct-dimensions-test.cldt`
**Purpose:** Control test - no hints should appear
**Content:**

```
https://res.cloudinary.com/demo/image/upload/w_500,h_300,c_fill/sample.jpg
```

**Expected Hints:** None (hints area should remain hidden)

## Testing the Hints Feature

1. Open any of the hints test files
2. Run the command: "CLDT: Show Preview" (or use the keyboard shortcut)
3. Observe the hints area below the header in the preview window
4. The hints area will smoothly expand if any issues are detected
5. Each hint shows:
   - An icon (⚠️ warning, ❌ error, ℹ️ info)
   - A clear description of the issue
   - Suggestions for how to fix it

## Hints Feature Benefits

- **Real-time feedback** on common Cloudinary URL issues
- **Contextual help** with specific suggestions
- **Learning tool** to understand Cloudinary best practices
- **Error prevention** before deploying to production
- **Visual indicators** for quick problem identification

## How to Use Examples

1. Open a `.cldt` file in VS Code
2. The syntax highlighting will automatically activate
3. Use hover to see parameter descriptions
4. Run "CLDT: Show Preview" to see the image preview
5. Use formatting commands to clean up the URL structure
6. Check the hints area for any warnings or suggestions

## Adding Your Own Examples

Feel free to create your own `.cldt` files to test different Cloudinary transformations. The extension will automatically provide:

- Syntax highlighting
- Hover information
- Code completion
- Formatting
- Live preview with hints

## Need Help?

Refer to the main documentation files:

- `README.md` - Main documentation
- `HINTS.md` - Detailed hints feature documentation
- `FORMATTER.md` - Formatting feature documentation
- `FEATURES-UPDATE.md` - Recent feature updates
