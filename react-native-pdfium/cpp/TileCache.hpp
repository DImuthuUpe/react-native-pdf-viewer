//
//  TileCache.hpp
//  Pods
//
//  Created by Dimuthu Wannipurage on 3/3/25.
//

#include <iostream>
#include <unordered_map>
#include <list>
#include <stdexcept>
#include <mutex>

namespace margelo::nitro::pdfium {

template<typename Key, typename Value>
class LRUCache {
    public:
        
        std::optional<Value> get(const Key &key) {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = cacheItemsMap.find(key);
            if (it == cacheItemsMap.end()) {
                return std::nullopt; // Key not found, return empty optional.
            }
            // Move the accessed item to the front of the list (mark as most recently used).
            cacheItemsList.splice(cacheItemsList.begin(), cacheItemsList, it->second);
            return it->second->second;
        }
        
        void put(const Key &key, const Value &value) {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = cacheItemsMap.find(key);
            if (it != cacheItemsMap.end()) {
                // Update existing item and move it to the front.
                it->second->second = value;
                cacheItemsList.splice(cacheItemsList.begin(), cacheItemsList, it->second);
            } else {
                if (cacheItemsMap.size() == capacity_) {
                    // Remove the least recently used item (back of the list).
                    auto last = cacheItemsList.end();
                    --last;
                    cacheItemsMap.erase(last->first);
                    cacheItemsList.pop_back();
                }
                // Insert the new key-value pair at the front of the list.
                cacheItemsList.push_front(std::make_pair(key, value));
                cacheItemsMap[key] = cacheItemsList.begin();
            }
        }
        
    private:
        size_t capacity_ = 10;
        std::list<std::pair<Key, Value>> cacheItemsList;
        std::unordered_map<Key, typename std::list<std::pair<Key, Value>>::iterator> cacheItemsMap;
        mutable std::mutex mutex_; // Protects the internal data structures.
    };

}
