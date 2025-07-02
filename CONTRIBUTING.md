# Contributing to Hebrew AI Agents Platform

אנו שמחים שאתם מעוניינים לתרום לפרויקט! 

We're excited that you're interested in contributing to the Hebrew AI Agents Platform!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/hebrew-ai-agents-platform.git
   cd hebrew-ai-agents-platform
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/jufjuf/hebrew-ai-agents-platform.git
   ```
4. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

Follow the instructions in the [Getting Started guide](docs/getting-started.md) to set up your development environment.

## Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint rules (run `npm run lint`)
- Use meaningful variable names
- Add JSDoc comments for functions

```typescript
/**
 * Analyzes Hebrew text for sentiment and entities
 * @param text - The Hebrew text to analyze
 * @returns Analysis results including sentiment and entities
 */
export async function analyzeHebrewText(text: string): Promise<AnalysisResult> {
  // Implementation
}
```

### Hebrew Content

When working with Hebrew content:
- Use UTF-8 encoding
- Test RTL rendering
- Consider both full and defective spelling
- Add appropriate Hebrew comments

```typescript
// פונקציה לנירמול טקסט עברי
function normalizeHebrewText(text: string): string {
  // טיפול באותיות סופיות
  // Handle final letters
}
```

### React Components

- Use functional components with hooks
- Implement proper RTL support
- Use Material-UI components
- Add proper TypeScript types

```tsx
interface AgentCardProps {
  agent: Agent;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onEdit, onDelete }) => {
  const { t } = useTranslation();
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          {agent.hebrewName || agent.name}
        </Typography>
      </CardContent>
    </Card>
  );
};
```

## Testing

### Unit Tests

Write tests for all new functionality:

```typescript
describe('HebrewNLP', () => {
  describe('normalizeText', () => {
    it('should handle final letters correctly', () => {
      expect(normalizeText('מימ')).toBe('מים');
    });
    
    it('should preserve nikud when requested', () => {
      expect(normalizeText('שָׁלוֹם', { preserveNikud: true }))
        .toBe('שָׁלוֹם');
    });
  });
});
```

### Integration Tests

Test API endpoints and integrations:

```typescript
describe('Agent API', () => {
  it('should create agent with Hebrew name', async () => {
    const response = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Support Agent',
        hebrewName: 'סוכן תמיכה',
        language: 'he'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.agent.hebrewName).toBe('סוכן תמיכה');
  });
});
```

## Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(hebrew-nlp): add nikud support for text processing

fix(chat): resolve RTL alignment issues in message bubbles

docs(api): add Hebrew examples to webhook documentation
```

## Pull Request Process

1. **Update your branch**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests**:
   ```bash
   npm test
   npm run lint
   ```

3. **Update documentation** if needed

4. **Create Pull Request**:
   - Use a clear, descriptive title
   - Reference any related issues
   - Include screenshots for UI changes
   - Describe testing performed

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Tested with Hebrew content
- [ ] Tested RTL rendering

## Screenshots (if applicable)
[Add screenshots here]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
```

## Hebrew-Specific Guidelines

### RTL Testing

Always test components in RTL mode:

```typescript
// Test component in RTL
it('renders correctly in RTL', () => {
  const { container } = render(
    <ThemeProvider theme={createTheme({ direction: 'rtl' })}>
      <YourComponent />
    </ThemeProvider>
  );
  
  expect(container.firstChild).toHaveStyle('direction: rtl');
});
```

### Translation Keys

When adding new UI text:

1. Add to both Hebrew and English locales:
   ```json
   // locales/he.json
   {
     "feature": {
       "newButton": "כפתור חדש"
     }
   }
   
   // locales/en.json
   {
     "feature": {
       "newButton": "New Button"
     }
   }
   ```

2. Use translation in component:
   ```typescript
   const { t } = useTranslation();
   return <Button>{t('feature.newButton')}</Button>;
   ```

### Hebrew Content Best Practices

1. **Proper Encoding**: Always use UTF-8
2. **Mixed Content**: Handle Hebrew-English mixing properly
3. **Date Formats**: Use Israeli date format (DD/MM/YYYY)
4. **Currency**: Support Israeli Shekel (₪)
5. **Phone Numbers**: Support Israeli format (+972)

## Code Review

All submissions require review. We use GitHub pull requests for this purpose.

### Review Checklist

- [ ] Code quality and style
- [ ] Test coverage
- [ ] Documentation updates
- [ ] Hebrew content handling
- [ ] RTL support
- [ ] Performance implications
- [ ] Security considerations

## Community

### Communication Channels

- **Discord**: [Join our server](https://discord.gg/hebrew-ai-agents)
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For general discussions

### Code of Conduct

Please note that this project is released with a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

## Questions?

Feel free to:
- Open an issue
- Ask in Discord
- Email: contributors@hebrew-ai-agents.co.il

## License

By contributing, you agree that your contributions will be licensed under the MIT License.