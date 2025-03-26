import React, { useState } from 'react';

const commands = [
    { id: 1, name: 'Open Google', action: () => window.open('https://google.com', '_blank') },
    { id: 2, name: 'Open GitHub', action: () => window.open('https://github.com', '_blank') },
    { id: 3, name: 'Show Date', action: () => alert(new Date().toLocaleString()) },
];

export default function CommandPalette() {
    const [query, setQuery] = useState('');
    const [filteredCommands, setFilteredCommands] = useState(commands);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        setFilteredCommands(
            commands.filter((cmd) => cmd.name.toLowerCase().includes(value.toLowerCase()))
        );
    };

    const handleCommandClick = (command) => {
        command.action();
        setQuery('');
        setFilteredCommands(commands);
    };

    return (
        <div className="command-palette">
            <input
                type="text"
                placeholder="Type a command..."
                value={query}
                onChange={handleInputChange}
                className="command-input"
            />
            <ul className="command-list">
                {filteredCommands.map((cmd) => (
                    <li key={cmd.id} onClick={() => handleCommandClick(cmd)}>
                        {cmd.name}
                    </li>
                ))}
            </ul>
        </div>
    );
}
