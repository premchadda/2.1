import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { forwardRef } from 'react';

const Row = ({ index, style, data }) => {
  const { items, renderItem } = data;
  return (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  );
};

const VirtualList = forwardRef(({ items, renderItem, itemHeight = 50, overscanCount = 5 }, ref) => {
  const getItemSize = (index) => {
    if (typeof itemHeight === 'function') return itemHeight(index);
    return itemHeight;
  };

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          ref={ref}
          height={height}
          width={width}
          itemCount={items.length}
          itemSize={getItemSize}
          overscanCount={overscanCount}
          itemData={{ items, renderItem }}
        >
          {Row}
        </List>
      )}
    </AutoSizer>
  );
});

VirtualList.displayName = 'VirtualList';

export default VirtualList;